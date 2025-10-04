const { AppError } = require('./errorHandler');

const validateUpload = (req, res, next) => {
    // Check if files are present
    if (!req.files) {
        return next(new AppError('No files uploaded', 400));
    }

    const { cv, project_report } = req.files;

    // Check if both files are present
    if (!cv || cv.length === 0) {
        return next(new AppError('CV file is required', 400));
    }

    if (!project_report || project_report.length === 0) {
        return next(new AppError('Project report file is required', 400));
    }

    // Validate file types
    if (cv[0].mimetype !== 'application/pdf') {
        return next(new AppError('CV must be a PDF file', 400));
    }

    if (project_report[0].mimetype !== 'application/pdf') {
        return next(new AppError('Project report must be a PDF file', 400));
    }

    next();
};

module.exports = {
    validateUpload,
    validateEvaluate
};