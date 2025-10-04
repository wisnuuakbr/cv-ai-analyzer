const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { AppError } = require('./errorHandler');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(process.cwd(), config.upload.uploadDir);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Check MIME type
    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new AppError('Only PDF files are allowed', 400), false);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
        return cb(new AppError('Only PDF files are allowed', 400), false);
    }

    cb(null, true);
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config.upload.maxFileSize
    }
});

// Middleware to handle multiple files
const uploadFields = upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'project_report', maxCount: 1 }
]);

// Wrapper to handle multer errors
const uploadMiddleware = (req, res, next) => {
    uploadFields(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('File size exceeds the maximum limit of 10MB', 400));
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return next(new AppError('Unexpected field in upload', 400));
            }
            return next(new AppError(`Upload error: ${err.message}`, 400));
        } else if (err) {
            return next(err);
        }
        next();
    });
};

module.exports = { uploadMiddleware };