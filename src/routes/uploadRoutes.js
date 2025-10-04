const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { uploadMiddleware } = require('../middlewares/upload');
const { validateUpload } = require('../middlewares/validation');

// POST /api/upload
router.post(
    '/',
    uploadMiddleware,
    validateUpload,
    uploadController.uploadDocuments
);

module.exports = router;