const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
        host: config.database.host,
        port: config.database.port,
        dialect: config.database.dialect,
        logging: config.database.logging,
        pool: config.database.pool,
    }
);

const connectDatabase = async () => {
    let retries = 10;
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    while (retries) {
        try {
            await sequelize.authenticate();
            logger.info('Database connection established successfully');

            if (config.server.env === 'development') {
                await sequelize.sync({ alter: true });
                logger.info('Database models synchronized');
            }

            break;
        } catch (error) {
            retries -= 1;
            logger.warn(`Database not ready (retries left: ${retries})`);
            logger.warn(error.message);

            if (!retries) {
                logger.error('Unable to connect to database after multiple attempts');
                throw error;
            }

            await delay(10000);
        }
    }
};

module.exports = { sequelize, connectDatabase };