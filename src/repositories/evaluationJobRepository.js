const { EvaluationJob, Document, EvaluationResult } = require('../models');
const logger = require('../utils/logger');

class EvaluationJobRepository {
    async create(data) {
        try {
            const job = await EvaluationJob.create(data);
            logger.info(`Evaluation job created: ${job.id}`);
            return job;
        } catch (error) {
            logger.error('Error creating evaluation job:', error);
            throw error;
        }
    }

    async findById(id) {
        try {
            const job = await EvaluationJob.findByPk(id, {
                include: [
                    {
                        model: Document,
                        as: 'cvDocument',
                        attributes: ['id', 'original_name', 'file_path', 'file_type']
                    },
                    {
                        model: Document,
                        as: 'projectDocument',
                        attributes: ['id', 'original_name', 'file_path', 'file_type']
                    },
                    {
                        model: EvaluationResult,
                        as: 'result'
                    }
                ]
            });
            return job;
        } catch (error) {
            logger.error('Error finding evaluation job:', error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            const job = await EvaluationJob.findByPk(id);
            if (!job) {
                return null;
            }
            await job.update(data);
            logger.info(`Evaluation job updated: ${id}`);
            return job;
        } catch (error) {
            logger.error('Error updating evaluation job:', error);
            throw error;
        }
    }

    async updateStatus(id, status, additionalData = {}) {
        try {
            const updateData = { status, ...additionalData };

            if (status === 'processing' && !additionalData.started_at) {
                updateData.started_at = new Date();
            }

            if (status === 'completed' && !additionalData.completed_at) {
                updateData.completed_at = new Date();
            }

            return await this.update(id, updateData);
        } catch (error) {
            logger.error('Error updating job status:', error);
            throw error;
        }
    }

    async findQueuedJobs(limit = 10) {
        try {
            const jobs = await EvaluationJob.findAll({
                where: { status: 'queued' },
                order: [['created_at', 'ASC']],
                limit: limit,
                include: [
                    {
                        model: Document,
                        as: 'cvDocument'
                    },
                    {
                        model: Document,
                        as: 'projectDocument'
                    }
                ]
            });
            return jobs;
        } catch (error) {
            logger.error('Error finding queued jobs:', error);
            throw error;
        }
    }

    async incrementRetryCount(id) {
        try {
            const job = await EvaluationJob.findByPk(id);
            if (!job) {
                return null;
            }
            await job.increment('retry_count');
            logger.info(`Retry count incremented for job: ${id}`);
            return job;
        } catch (error) {
            logger.error('Error incrementing retry count:', error);
            throw error;
        }
    }
}

module.exports = new EvaluationJobRepository();