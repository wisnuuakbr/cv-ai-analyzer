const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');

// GET /api/result/:id
router.get('/:id', evaluationController.getResult);

module.exports = router;