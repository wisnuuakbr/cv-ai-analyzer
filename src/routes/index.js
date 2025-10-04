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

module.exports = router;