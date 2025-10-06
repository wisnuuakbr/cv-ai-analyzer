const { Sequelize } = require('sequelize');
const config = require('../config');

// Import models
const Document = require('./document');
const EvaluationJob = require('./evaluationJob');
const EvaluationResult = require('./evaluationResult');
const Content = require('./content');

const dbConfig = config.database;

// Initialize Sequelize
const sequelize = new Sequelize(
    dbConfig.name,
    dbConfig.user,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: dbConfig.logging,
        pool: dbConfig.pool
    }
);

// Initialize models
const models = {
    Document: Document.init(sequelize),
    EvaluationJob: EvaluationJob.init(sequelize),
    EvaluationResult: EvaluationResult.init(sequelize),
    Content: Content.init(sequelize)
};

// Set up associations
Object.values(models).forEach(model => {
    if (model.associate) {
        model.associate(models);
    }
});

module.exports = {
    sequelize,
    ...models
};
