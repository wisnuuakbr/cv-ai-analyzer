const Joi = require('joi');
const { AppError } = require('./errorHandler');

// Schema definitions
const uploadSchema = Joi.object({
    files: Joi.object({
        cv: Joi.array().items(
            Joi.object({
                mimetype: Joi.string().valid('application/pdf').required()
                    .messages({
                        'string.base': 'CV must be a PDF file',
                        'any.only': 'CV must be a PDF file'
                    }),
                size: Joi.number().required(),
                originalname: Joi.string().required(),
                filename: Joi.string().required(),
                path: Joi.string().required()
            }).unknown(true) // Allow other multer fields
        ).min(1).required()
            .messages({
                'any.required': 'CV file is required',
                'array.min': 'CV file is required'
            }),
        project_report: Joi.array().items(
            Joi.object({
                mimetype: Joi.string().valid('application/pdf').required()
                    .messages({
                        'string.base': 'Project report must be a PDF file',
                        'any.only': 'Project report must be a PDF file'
                    }),
                size: Joi.number().required(),
                originalname: Joi.string().required(),
                filename: Joi.string().required(),
                path: Joi.string().required()
            }).unknown(true) // Allow other multer fields
        ).min(1).required()
            .messages({
                'any.required': 'Project report file is required',
                'array.min': 'Project report file is required'
            })
    }).required()
});

const evaluateSchema = Joi.object({
    job_title: Joi.string().trim().min(1).required()
        .messages({
            'string.empty': 'Job title is required',
            'string.min': 'Job title is required',
            'any.required': 'Job title is required'
        }),
    cv_document_id: Joi.string().uuid().required()
        .messages({
            'string.empty': 'CV document ID is required',
            'string.guid': 'Invalid CV document ID format',
            'any.required': 'CV document ID is required'
        }),
    project_document_id: Joi.string().uuid().required()
        .messages({
            'string.empty': 'Project document ID is required',
            'string.guid': 'Invalid project document ID format',
            'any.required': 'Project document ID is required'
        })
});

const searchContextSchema = Joi.object({
    query: Joi.string().trim().min(1).required()
        .messages({
            'string.empty': 'Query is required',
            'string.min': 'Query is required',
            'any.required': 'Query is required'
        }),
    document_type: Joi.string().valid(
        'job_description',
        'case_study_brief',
        'scoring_rubric'
    ).optional().allow(null)
        .messages({
            'any.only': 'Invalid document type. Must be one of: job_description, case_study_brief, scoring_rubric'
        }),
    section: Joi.string().valid(
        'cv_evaluation',
        'project_evaluation'
    ).optional().allow(null)
        .messages({
            'any.only': 'Invalid section. Must be one of: cv_evaluation, project_evaluation'
        }),
    limit: Joi.number().integer().min(1).max(20).default(5)
        .messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 20'
        })
});

// Validation for upload
const validateUpload = (req, res, next) => {
    // Check if files are present
    if (!req.files) {
        return next(new AppError('No files uploaded', 400));
    }

    const { error } = uploadSchema.validate({ files: req.files }, { abortEarly: false });

    if (error) {
        const message = error.details.map(d => d.message).join(', ');
        return next(new AppError(message, 400));
    }

    next();
};

// Validation for evaluate
const validateEvaluate = (req, res, next) => {
    const { error, value } = evaluateSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const message = error.details.map(d => d.message).join(', ');
        return next(new AppError(message, 400));
    }

    req.body = value;
    next();
};

// Validation for search context
const validateSearchContext = (req, res, next) => {
    const { error, value } = searchContextSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const message = error.details.map(d => d.message).join(', ');
        return next(new AppError(message, 400));
    }

    req.body = value;
    next();
};

module.exports = {
    validateUpload,
    validateEvaluate,
    validateSearchContext
};