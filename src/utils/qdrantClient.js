const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('../config');
const logger = require('./logger');

class QdrantClientWrapper {
    constructor() {
        this.client = null;
        this.initialized = false;
    }

    // Initialize Qdrant client
    async initialize() {
        try {
            // Create Qdrant client
            this.client = new QdrantClient({
                url: `http://${config.qdrant.host}:${config.qdrant.port}`,
                apiKey: config.qdrant.apiKey,
            });

            // Test connection
            await this.client.getCollections();

            this.initialized = true;
            logger.info('Qdrant client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Qdrant client:', error);
            throw error;
        }
    }

    // Create collection if not exists
    async createCollection(collectionName, vectorSize = 384) {
        try {
            // Check if collection exists
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(
                col => col.name === collectionName
            );

            if (exists) {
                logger.info(`Collection ${collectionName} already exists`);
                return;
            }

            // Create collection
            await this.client.createCollection(collectionName, {
                vectors: {
                    size: vectorSize,
                    distance: 'Cosine',
                },
            });

            logger.info(`Collection ${collectionName} created successfully`);
        } catch (error) {
            logger.error(`Error creating collection ${collectionName}:`, error);
            throw error;
        }
    }

    // Delete collection
    async deleteCollection(collectionName) {
        try {
            await this.client.deleteCollection(collectionName);
            logger.info(`Collection ${collectionName} deleted`);
        } catch (error) {
            logger.error(`Error deleting collection ${collectionName}:`, error);
            throw error;
        }
    }

    // Upsert points (documents) into collection
    async upsertPoints(collectionName, points) {
        try {
            await this.client.upsert(collectionName, {
                wait: true,
                points: points,
            });

            logger.info(`Upserted ${points.length} points to ${collectionName}`);
        } catch (error) {
            logger.error('Error upserting points:', error);
            throw error;
        }
    }

    // Search similar documents
    async search(collectionName, queryVector, limit = 5, filter = null) {
        try {
            const searchParams = {
                vector: queryVector,
                limit: limit,
            };

            if (filter) {
                searchParams.filter = filter;
            }

            const results = await this.client.search(collectionName, searchParams);

            logger.info(`Found ${results.length} similar documents in ${collectionName}`);
            return results;
        } catch (error) {
            logger.error('Error searching:', error);
            throw error;
        }
    }

    // Get point by ID
    async getPoint(collectionName, pointId) {
        try {
            const points = await this.client.retrieve(collectionName, {
                ids: [pointId],
                with_payload: true,
                with_vector: false,
            });

            return points.length > 0 ? points[0] : null;
        } catch (error) {
            logger.error('Error getting point:', error);
            throw error;
        }
    }

    // Delete point by ID
    async deletePoint(collectionName, pointId) {
        try {
            await this.client.delete(collectionName, {
                wait: true,
                points: [pointId],
            });

            logger.info(`Deleted point ${pointId} from ${collectionName}`);
        } catch (error) {
            logger.error('Error deleting point:', error);
            throw error;
        }
    }

    // Count points in collection
    async countPoints(collectionName) {
        try {
            const response = await this.client.count(collectionName);
            return response.count;
        } catch (error) {
            logger.error('Error counting points:', error);
            throw error;
        }
    }

    // Get collection info
    async getCollectionInfo(collectionName) {
        try {
            const info = await this.client.getCollection(collectionName);
            return info;
        } catch (error) {
            logger.error('Error getting collection info:', error);
            throw error;
        }
    }

    // Scroll through all points
    async scrollPoints(collectionName, limit = 100) {
        try {
            const result = await this.client.scroll(collectionName, {
                limit: limit,
                with_payload: true,
                with_vector: false,
            });

            return result.points;
        } catch (error) {
            logger.error('Error scrolling points:', error);
            throw error;
        }
    }

    // Close client connection
    async close() {
        if (this.client) {
            this.client = null;
            this.initialized = false;
            logger.info('Qdrant client closed');
        }
    }
}

// Singleton instance
const qdrantClient = new QdrantClientWrapper();

module.exports = qdrantClient;