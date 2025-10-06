const evaluationJobRepository = require('../repositories/evaluationJobRepository');
const uploadUseCase = require('./uploadUseCase');
const queueManager = require('../utils/queueManager');
const logger = require('../utils/logger');
const { AppError } = require('../middlewares/errorHandler');

class EvaluationUseCase {
    // Create new evaluation job
    async createEvaluationJob(jobTitle, cvDocumentId, projectDocumentId) {
        try {
            // Validate documents exist
            const { cvDoc, projectDoc } = await uploadUseCase.validateDocuments(
                cvDocumentId,
                projectDocumentId
            );

            // Create evaluation job in database
            const job = await evaluationJobRepository.create({
                job_title: jobTitle,
                cv_document_id: cvDocumentId,
                project_document_id: projectDocumentId,
                status: 'queued'
            });

            // Add to BullMQ queue
            await queueManager.addEvaluationJob({
                jobId: job.id,
                jobTitle: jobTitle,
                cvDocumentId: cvDocumentId,
                projectDocumentId: projectDocumentId,
            });

            logger.info(`Evaluation job created and queued: ${job.id}`);

            return {
                id: job.id,
                status: job.status
            };
        } catch (error) {
            logger.error('Error creating evaluation job:', error);
            throw error;
        }
    }

    // Get evaluation job and result by ID
    async getEvaluationResult(jobId) {
        try {
            // Get job from database
            const job = await evaluationJobRepository.findById(jobId);

            if (!job) {
                throw new AppError('Evaluation job not found', 404);
            }

            // Base response
            const response = {
                id: job.id,
                status: job.status
            };

            // Try to get queue job for progress info
            try {
                const queueJob = await queueManager.getJob(jobId);
                if (queueJob) {
                    const state = await queueJob.getState();
                    response.queueState = state;

                    if (queueJob.progress) {
                        response.progress = queueJob.progress;
                    }
                }
            } catch (queueError) {
                // Queue job might not exist
                logger.debug('Queue job not found, using database status');
            }

            // If completed, include result
            if (job.status === 'completed' && job.result) {
                response.result = {
                    cv_match_rate: parseFloat(job.result.cv_match_rate),
                    cv_feedback: job.result.cv_feedback,
                    project_score: parseFloat(job.result.project_score),
                    project_feedback: job.result.project_feedback,
                    overall_summary: job.result.overall_summary
                };
            }

            // If failed, include error
            if (job.status === 'failed') {
                response.error = job.error_message;
                response.retry_count = job.retry_count;
            }

            return response;
        } catch (error) {
            logger.error('Error getting evaluation result:', error);
            throw error;
        }
    }

    // Get queue statistic
    async getQueueStats() {
        try {
            const stats = await queueManager.getQueueStats();
            return stats;
        } catch (error) {
            logger.error('Error getting queue stats:', error);
            throw error;
        }
    }

    // Retry a failed job by ID
    async retryJob(jobId) {
        try {
            const job = await evaluationJobRepository.findById(jobId);

            if (!job) {
                throw new AppError('Evaluation job not found', 404);
            }

            if (job.status !== 'failed') {
                throw new AppError('Only failed jobs can be retried', 400);
            }

            // Update status back to queued
            await evaluationJobRepository.updateStatus(jobId, 'queued', {
                error_message: null
            });

            // Re-add to queue
            await queueManager.addEvaluationJob({
                jobId: job.id,
                jobTitle: job.job_title,
                cvDocumentId: job.cv_document_id,
                projectDocumentId: job.project_document_id,
            });

            logger.info(`Job retried: ${jobId}`);

            return {
                id: jobId,
                status: 'queued',
                message: 'Job has been re-queued for processing'
            };
        } catch (error) {
            logger.error('Error retrying job:', error);
            throw error;
        }
    }

    // Cancel a queued or processing job
    async cancelJob(jobId) {
        try {
            const job = await evaluationJobRepository.findById(jobId);

            if (!job) {
                throw new AppError('Evaluation job not found', 404);
            }

            if (job.status === 'completed') {
                throw new AppError('Cannot cancel completed job', 400);
            }

            // Remove from queue
            await queueManager.removeJob(jobId);

            // Update status to failed with cancellation message
            await evaluationJobRepository.updateStatus(jobId, 'failed', {
                error_message: 'Job cancelled by user'
            });

            logger.info(`Job cancelled: ${jobId}`);

            return {
                id: jobId,
                status: 'failed',
                message: 'Job has been cancelled'
            };
        } catch (error) {
            logger.error('Error cancelling job:', error);
            throw error;
        }
    }
}

module.exports = new EvaluationUseCase();