const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Upload routes
const uploadRoutes = require('./uploadRoutes');
router.use('/upload', uploadRoutes);

// Evaluation routes
const evaluationRoutes = require('./evaluationRoutes');
router.use('/evaluate', evaluationRoutes);

// Result routes
const resultRoutes = require('./resultRoutes');
router.use('/result', resultRoutes);

module.exports = router;