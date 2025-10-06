const logger = require('../utils/logger');

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    let { statusCode = 500, message } = err;

    // Log error with stack trace
    logger.error(`Error: ${message}`, {
        statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Sequelize validation error
    if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        message = err.errors.map(e => e.message).join(', ');
    }

    // Sequelize unique constraint error
    if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        message = 'Resource already exists';
    }

    // Sequelize foreign key constraint error
    if (err.name === 'SequelizeForeignKeyConstraintError') {
        statusCode = 400;
        message = 'Invalid reference to related resource';
    }

    // Multer file upload error
    if (err.name === 'MulterError') {
        statusCode = 400;
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size exceeds the maximum limit';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files uploaded';
        } else {
            message = 'File upload error';
        }
    }

    // Joi validation error
    if (err.name === 'ValidationError' && err.isJoi) {
        statusCode = 400;
        message = err.details.map(d => d.message).join(', ');
    }

    const response = {
        success: false,
        message: message || 'Internal server error'
    };

    res.status(statusCode).json(response);
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    asyncHandler,
    AppError
};