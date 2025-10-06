require('dotenv').config();
const vectorStoreUseCase = require('../src/usecases/vectorStoreUseCase');
const logger = require('../src/utils/logger');

async function ingestDocuments() {
    try {
        logger.info('='.repeat(60));
        logger.info('Starting Reference Documents Ingestion');
        logger.info('='.repeat(60));

        // Initialize vector store
        await vectorStoreUseCase.initialize();

        // Ingest documents
        const results = await vectorStoreUseCase.ingestReferenceDocuments();

        // Display results
        logger.info('\n' + '='.repeat(60));
        logger.info('Ingestion Results:');
        logger.info('='.repeat(60));

        results.forEach(result => {
            if (result.status === 'success') {
                logger.info(`${result.filename} (${result.type}): ${result.chunks} chunks`);
            } else {
                logger.warn(`${result.filename} (${result.type}): ${result.error || 'Failed'}`);
            }
        });

        // Get statistics
        const stats = await vectorStoreUseCase.getStatistics();
        logger.info('\n' + '='.repeat(60));
        logger.info('Vector Store Statistics:');
        logger.info('='.repeat(60));
        logger.info(`Collection: ${stats.collection}`);
        logger.info(`Total Points: ${stats.total_points}`);
        logger.info(`Vector Size: ${stats.vector_size}`);
        logger.info(`Distance Metric: ${stats.distance}`);
        logger.info(`Status: ${stats.status}`);

        logger.info('\n' + '='.repeat(60));
        logger.info('Ingestion Completed Successfully!');
        logger.info('='.repeat(60));

        process.exit(0);
    } catch (error) {
        logger.error('Error during ingestion:', error);
        process.exit(1);
    }
}

// Run ingestion
ingestDocuments();