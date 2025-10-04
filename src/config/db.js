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
    try {
        await sequelize.authenticate();
        logger.info('Database connection established successfully');

        if (config.server.env === 'development') {
            await sequelize.sync({ alter: true });
            logger.info('Database models synchronized');
        }
    } catch (error) {
        logger.error('Unable to connect to database:', error);
        throw error;
    }
};

module.exports = { sequelize, connectDatabase };