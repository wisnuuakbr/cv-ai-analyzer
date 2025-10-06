const evaluationUseCase = require('../usecases/evaluationUseCase');
const { asyncHandler } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

class EvaluationController {
    createEvaluation = asyncHandler(async (req, res) => {
        const { job_title, cv_document_id, project_document_id } = req.body;

        logger.info(`Evaluation request received for job: ${job_title}`);

        const result = await evaluationUseCase.createEvaluationJob(
            job_title,
            cv_document_id,
            project_document_id
        );

        res.status(202).json({
            success: true,
            message: 'Evaluation job created and queued',
            data: result
        });
    });

    getResult = asyncHandler(async (req, res) => {
        const { id } = req.params;

        logger.info(`Result request for job: ${id}`);

        const result = await evaluationUseCase.getEvaluationResult(id);

        res.status(200).json({
            success: true,
            data: result
        });
    });

    getQueueStatus = asyncHandler(async (req, res) => {
        logger.info('Queue status request');

        const stats = await evaluationUseCase.getQueueStats();

        res.status(200).json({
            success: true,
            data: stats
        });
    });

    retryJob = asyncHandler(async (req, res) => {
        const { id } = req.params;

        logger.info(`Retry request for job: ${id}`);

        const result = await evaluationUseCase.retryJob(id);

        res.status(200).json({
            success: true,
            data: result
        });
    });

    cancelJob = asyncHandler(async (req, res) => {
        const { id } = req.params;

        logger.info(`Cancel request for job: ${id}`);

        const result = await evaluationUseCase.cancelJob(id);

        res.status(200).json({
            success: true,
            data: result
        });
    });
}

module.exports = new EvaluationController();