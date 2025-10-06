const { EvaluationResult } = require('../models');
const logger = require('../utils/logger');

class EvaluationResultRepository {
    async create(data) {
        try {
            const result = await EvaluationResult.create(data);
            logger.info(`Evaluation result created for job: ${result.evaluation_job_id}`);
            return result;
        } catch (error) {
            logger.error('Error creating evaluation result:', error);
            throw error;
        }
    }

    async findByJobId(jobId) {
        try {
            const result = await EvaluationResult.findOne({
                where: { evaluation_job_id: jobId }
            });
            return result;
        } catch (error) {
            logger.error('Error finding evaluation result:', error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            const result = await EvaluationResult.findByPk(id);
            if (!result) {
                return null;
            }
            await result.update(data);
            logger.info(`Evaluation result updated: ${id}`);
            return result;
        } catch (error) {
            logger.error('Error updating evaluation result:', error);
            throw error;
        }
    }

    async upsert(data) {
        try {
            const [result, created] = await EvaluationResult.upsert(data, {
                returning: true
            });
            logger.info(`Evaluation result ${created ? 'created' : 'updated'} for job: ${data.evaluation_job_id}`);
            return result;
        } catch (error) {
            logger.error('Error upserting evaluation result:', error);
            throw error;
        }
    }
}

module.exports = new EvaluationResultRepository();