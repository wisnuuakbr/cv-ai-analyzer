const app = require('./app');
const config = require('./config');
const { connectDatabase } = require('./config/db');
const logger = require('./utils/logger');
const queueManager = require('./utils/queueManager');
const evaluationWorker = require('./workers/evaluationWorker');
const vectorStoreUseCase = require('./usecases/vectorStoreUseCase');

const startServer = async () => {
    try {
        // Connect to database
        await connectDatabase();
        logger.info('Database connected successfully');

        // Initialize queue manager, worker, and vector
        queueManager.initialize();
        evaluationWorker.initialize();
        await vectorStoreUseCase.initialize();

        // Start server
        const server = app.listen(config.server.port, () => {
            logger.info(`Server running on port ${config.server.port} in ${config.server.env} mode`);
            logger.info(`Health check available at http://localhost:${config.server.port}/api/health`);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} signal received: closing HTTP server`);
            server.close(async () => {
                logger.info('HTTP server closed');

                // Close queue manager
                await queueManager.close();
                logger.info('Queue manager closed');

                // Close worker
                await evaluationWorker.close();
                logger.info('Worker closed');

                process.exit(0);
            });

            // Force close after 10 seconds
            setTimeout(() => {
                logger.error('Forcing shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();