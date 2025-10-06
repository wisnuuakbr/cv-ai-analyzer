const { Queue } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

class QueueManager {
    constructor() {
        this.connection = null;
        this.evaluationQueue = null;
        this.initialized = false;
    }

    // Initialize Redis connection and queue
    initialize() {
        try {
            // Create Redis connection
            this.connection = new Redis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db,
                maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            });

            this.connection.on('connect', () => {
                logger.info('Redis connected successfully');
            });

            this.connection.on('error', (error) => {
                logger.error('Redis connection error:', error);
            });

            // Create evaluation queue
            this.evaluationQueue = new Queue(
                config.queue.evaluationQueueName,
                {
                    connection: this.connection,
                    defaultJobOptions: config.queue.defaultJobOptions,
                }
            );

            this.initialized = true;
            logger.info('Queue manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize queue manager:', error);
            throw error;
        }
    }

    // Add evaluation job to queue
    async addEvaluationJob(jobData) {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            const job = await this.evaluationQueue.add(
                'evaluate',
                jobData,
                {
                    jobId: jobData.jobId,
                    priority: jobData.priority || 1,
                }
            );

            logger.info(`Job added to queue: ${job.id}`);
            return job;
        } catch (error) {
            logger.error('Error adding job to queue:', error);
            throw error;
        }
    }

    // Get job by ID
    async getJob(jobId) {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            const job = await this.evaluationQueue.getJob(jobId);
            return job;
        } catch (error) {
            logger.error(`Error getting job ${jobId}:`, error);
            throw error;
        }
    }

    // Get job state
    async getJobState(jobId) {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            const job = await this.getJob(jobId);
            if (!job) {
                return null;
            }
            const state = await job.getState();
            return state;
        } catch (error) {
            logger.error(`Error getting job state ${jobId}:`, error);
            throw error;
        }
    }

    // Remove job from queue by ID
    async removeJob(jobId) {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            const job = await this.getJob(jobId);
            if (job) {
                await job.remove();
                logger.info(`Job removed: ${jobId}`);
            }
        } catch (error) {
            logger.error(`Error removing job ${jobId}:`, error);
            throw error;
        }
    }

    // Get queue statistic
    async getQueueStats() {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                this.evaluationQueue.getWaitingCount(),
                this.evaluationQueue.getActiveCount(),
                this.evaluationQueue.getCompletedCount(),
                this.evaluationQueue.getFailedCount(),
                this.evaluationQueue.getDelayedCount(),
            ]);

            return {
                waiting,
                active,
                completed,
                failed,
                delayed,
                total: waiting + active + completed + failed + delayed,
            };
        } catch (error) {
            logger.error('Error getting queue stats:', error);
            throw error;
        }
    }

    // Pause queuq
    async pauseQueue() {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            await this.evaluationQueue.pause();
            logger.info('Queue paused');
        } catch (error) {
            logger.error('Error pausing queue:', error);
            throw error;
        }
    }

    // Resume queue
    async resumeQueue() {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            await this.evaluationQueue.resume();
            logger.info('Queue resumed');
        } catch (error) {
            logger.error('Error resuming queue:', error);
            throw error;
        }
    }

    // Clean old jobs queue
    async cleanQueue(grace = 86400000, limit = 1000, status = 'completed') {
        if (!this.initialized) {
            throw new Error('Queue manager not initialized');
        }

        try {
            await this.evaluationQueue.clean(grace, limit, status);
            logger.info(`Queue cleaned: ${status} jobs older than ${grace}ms`);
        } catch (error) {
            logger.error('Error cleaning queue:', error);
            throw error;
        }
    }

    // Close queue and redis connecntion
    async close() {
        if (this.evaluationQueue) {
            await this.evaluationQueue.close();
        }
        if (this.connection) {
            await this.connection.quit();
        }
        this.initialized = false;
        logger.info('Queue manager closed');
    }
}

// Singleton instance
const queueManager = new QueueManager();

module.exports = queueManager;