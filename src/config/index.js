require('dotenv').config();

module.exports = {
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        name: process.env.DB_NAME || 'cv_ai_analyzer',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        maxRetriesPerRequest: 3,
    },
    queue: {
        evaluationQueueName: 'evaluation-jobs',
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: {
                count: 100, // Keep last 100 completed jobs
                age: 86400, // Keep for 24 hours
            },
            removeOnFail: {
                count: 1000, // Keep last 1000 failed jobs
            },
        },
    },
    huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY,
        baseURL: 'https://api-inference.huggingface.co/models',
        model: process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2',
        temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.3,
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2000,
    },
    qdrant: {
        host: process.env.QDRANT_HOST || 'localhost',
        port: parseInt(process.env.QDRANT_PORT) || 6333,
        collectionName: process.env.QDRANT_COLLECTION_NAME || 'evaluation_docs',
        apiKey: process.env.QDRANT_API_KEY || null,
    },
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        allowedMimeTypes: ['application/pdf'],
    },
    retry: {
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 2000,
        backoffMultiplier: parseInt(process.env.BACKOFF_MULTIPLIER) || 2,
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    }
};