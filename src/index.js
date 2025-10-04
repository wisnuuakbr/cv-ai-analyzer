const app = require('./app');
const config = require('./config');
const { connectDatabase } = require('./config/db');
const logger = require('./utils/logger');

const startServer = async () => {
    try {
        // Connect to database
        await connectDatabase();
        logger.info('Database connected successfully');

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
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();