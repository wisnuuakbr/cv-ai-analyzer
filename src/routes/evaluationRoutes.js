const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { validateEvaluate } = require('../middlewares/validation');

// POST /api/evaluate
router.post('/', validateEvaluate, evaluationController.createEvaluation);

// GET /api/evaluate/queue/status
router.get('/queue/status', evaluationController.getQueueStatus);

// POST /api/evaluate/:id/retry
router.post('/:id/retry', evaluationController.retryJob);

// DELETE /api/evaluate/:id
router.delete('/:id', evaluationController.cancelJob);

module.exports = router;