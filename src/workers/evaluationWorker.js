const { Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');
const evaluationJobRepository = require('../repositories/evaluationJobRepository');
const evaluationResultRepository = require('../repositories/evaluationResultRepository');
const contentRepository = require('../repositories/contentRepository');
const ragService = require('../services/ragService');

class EvaluationWorker {
    constructor() {
        this.worker = null;
        this.connection = null;
    }

    // Init worker
    initialize() {
        try {
            // Create Redis connection for worker
            this.connection = new Redis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db,
                maxRetriesPerRequest: null,
            });

            // Create worker
            this.worker = new Worker(
                config.queue.evaluationQueueName,
                async (job) => {
                    return await this.processJob(job);
                },
                {
                    connection: this.connection,
                    concurrency: 5, // Process up to 5 jobs concurrently
                    limiter: {
                        max: 10, // Max 10 jobs
                        duration: 1000, // Per second
                    },
                }
            );

            // Event listeners
            this.worker.on('completed', (job) => {
                logger.info(`Job completed: ${job.id}`);
            });

            this.worker.on('failed', (job, err) => {
                logger.error(`Job failed: ${job.id}`, err);
            });

            this.worker.on('error', (err) => {
                logger.error('Worker error:', err);
            });

            logger.info('Evaluation worker initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize worker:', error);
            throw error;
        }
    }

    // Process evalutaion job
    async processJob(job) {
        const { jobId } = job.data;

        try {
            logger.info(`Processing evaluation job: ${jobId}`);

            // Update job status to processing
            await evaluationJobRepository.updateStatus(jobId, 'processing');
            await job.updateProgress(10);

            // Get job details from database
            const evaluationJob = await evaluationJobRepository.findById(jobId);
            if (!evaluationJob) {
                throw new Error(`Job not found in database: ${jobId}`);
            }
            await job.updateProgress(20);

            // Get extracted content for CV and Project
            const cvContent = await contentRepository.findByDocumentId(
                evaluationJob.cv_document_id
            );
            const projectContent = await contentRepository.findByDocumentId(
                evaluationJob.project_document_id
            );

            // Validate content exists and is extracted
            if (!cvContent || cvContent.extraction_status !== 'completed') {
                throw new Error('CV content not extracted or extraction failed');
            }

            if (!projectContent || projectContent.extraction_status !== 'completed') {
                throw new Error('Project content not extracted or extraction failed');
            }
            await job.updateProgress(30);

            // Perform RAG-based evaluation
            await this.performRAGEvaluation(job, evaluationJob, cvContent, projectContent);
            await job.updateProgress(90);

            // Update job status to completed
            await evaluationJobRepository.updateStatus(jobId, 'completed');
            await job.updateProgress(100);

            logger.info(`Job processing completed: ${jobId}`);

            return { success: true, jobId };
        } catch (error) {
            logger.error(`Error processing job ${jobId}:`, error);

            // Update job status to failed
            await evaluationJobRepository.updateStatus(jobId, 'failed', {
                error_message: error.message,
            });

            // Increment retry count
            await evaluationJobRepository.incrementRetryCount(jobId);

            throw error;
        }
    }

    // Perform RAG-based evaluation
    async performRAGEvaluation(job, evaluationJob, cvContent, projectContent) {
        try {
            logger.info(`Starting RAG evaluation for job: ${evaluationJob.id}`);
            await job.updateProgress(35);

            // Evaluate CV using RAG
            logger.info('Evaluating CV with RAG...');
            const cvResult = await ragService.evaluateCV(
                cvContent,
                evaluationJob.job_title
            );
            await job.updateProgress(60);

            // Evaluate Project using RAG
            logger.info('Evaluating project with RAG...');
            const projectResult = await ragService.evaluateProject(
                projectContent
            );
            await job.updateProgress(80);

            // Generate overall summary
            logger.info('Generating overall summary...');
            const overallSummary = await ragService.generateOverallSummary(
                cvResult,
                projectResult,
                evaluationJob.job_title
            );
            await job.updateProgress(85);

            // Save complete evaluation result
            const evaluationResult = {
                evaluation_job_id: evaluationJob.id,
                ...cvResult,
                ...projectResult,
                overall_summary: overallSummary,
            };

            await evaluationResultRepository.upsert(evaluationResult);

            logger.info(`RAG evaluation completed for job: ${evaluationJob.id}`);

        } catch (error) {
            logger.error('Error in RAG evaluation:', error);

            // Fallback to rule-based evaluation if RAG fails
            logger.warn('Falling back to rule-based evaluation...');
            await this.fallbackEvaluation(job, evaluationJob, cvContent, projectContent);
        }
    }

    // Fallback evaluation when RAG fails
    async fallbackEvaluation(job, evaluationJob, cvContent, projectContent) {
        try {
            logger.info('Using fallback evaluation...');

            // Simple scoring based on extracted data
            const cvData = cvContent.extracted_data || {};
            const projectData = projectContent.extracted_data || {};

            // CV scoring
            const skillsCount = cvData.skills?.length || 0;
            const technicalScore = Math.min(5, Math.max(1, skillsCount / 2));
            const cvMatchRate = (technicalScore / 5) * 0.8; // Max 80% for fallback

            // Project scoring
            const codeBlocks = projectData.codeBlocks || 0;
            const wordCount = projectContent.word_count || 0;
            const projectScore = Math.min(5, Math.max(1, (codeBlocks + wordCount / 500) / 2));

            const evaluationResult = {
                evaluation_job_id: evaluationJob.id,
                cv_match_rate: cvMatchRate,
                cv_feedback: `CV contains ${skillsCount} technical skills. Fallback evaluation used due to RAG failure.`,
                cv_technical_skills_score: technicalScore,
                cv_experience_score: 3.0,
                cv_achievements_score: 3.0,
                cv_cultural_fit_score: 3.0,
                project_score: projectScore,
                project_feedback: `Project report contains ${codeBlocks} code blocks and ${wordCount} words. Fallback evaluation used.`,
                project_correctness_score: projectScore,
                project_code_quality_score: projectScore,
                project_resilience_score: 3.0,
                project_documentation_score: 3.5,
                project_creativity_score: 3.0,
                overall_summary: `Fallback evaluation completed. CV match rate: ${(cvMatchRate * 100).toFixed(0)}%, Project score: ${projectScore.toFixed(1)}/5. Manual review recommended.`,
            };

            await evaluationResultRepository.upsert(evaluationResult);

            logger.info('Fallback evaluation completed');
        } catch (fallbackError) {
            logger.error('Fallback evaluation also failed:', fallbackError);
            throw fallbackError;
        }
    }

    // Close worker
    async close() {
        if (this.worker) {
            await this.worker.close();
        }
        if (this.connection) {
            await this.connection.quit();
        }
        logger.info('Evaluation worker closed');
    }
}

// Singleton instance
const evaluationWorker = new EvaluationWorker();

module.exports = evaluationWorker;