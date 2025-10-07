const qdrantClient = require('../utils/qdrantClient');
const embeddingService = require('../services/embeddingService');
const pdfParser = require('../utils/pdfParser');
const config = require('../config');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

class VectorStoreUseCase {
    constructor() {
        this.collectionName = config.qdrant.collectionName;
        this.initialized = false;
    }

    // Initialize vector store
    async initialize() {
        try {
            logger.info('Initializing vector store...');

            // Initialize qdrant client and embedding service
            await qdrantClient.initialize();
            embeddingService.initialize();

            // Create collection if not exists
            await qdrantClient.createCollection(
                this.collectionName,
                embeddingService.getEmbeddingDimensions()
            );

            this.initialized = true;
            logger.info('Vector store initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize vector store:', error);
            throw error;
        }
    }

    // Ingest reference documents
    async ingestReferenceDocuments() {
        try {
            logger.info('Starting reference documents ingestion...');

            const docsPath = path.join(process.cwd(), 'docs');

            // Check if docs directory exists
            try {
                await fs.access(docsPath);
            } catch (error) {
                logger.warn('docs/ directory not found, creating it...');
                await fs.mkdir(docsPath, { recursive: true });

                logger.info('Please place reference documents in docs/ directory');
                return { message: 'docs/ directory created. Please add reference documents.' };
            }

            // Define expected reference documents
            const referenceFiles = [
                {
                    filename: 'job_description.pdf',
                    type: 'job_description',
                    description: 'Job description for the position'
                },
                {
                    filename: 'case_study_brief.pdf',
                    type: 'case_study_brief',
                    description: 'Case study brief document'
                },
                {
                    filename: 'scoring_rubric.pdf',
                    type: 'scoring_rubric',
                    description: 'Unified scoring rubric for CV and Project evaluation',
                    sections: ['cv_evaluation', 'project_evaluation']
                }
            ];

            const results = [];

            for (const refFile of referenceFiles) {
                const filePath = path.join(docsPath, refFile.filename);

                try {
                    // Check if file exists
                    await fs.access(filePath);

                    // Extract text from PDF
                    logger.info(`Processing ${refFile.filename}...`);
                    const extractedText = await pdfParser.extractCleanText(filePath);

                    // Handling scoring rubric based on file sections
                    if (refFile.type === 'scoring_rubric') {
                        const sections = this.extractScoringRubricSections(extractedText);

                        for (const [sectionType, sectionText] of Object.entries(sections)) {
                            const chunks = embeddingService.chunkText(sectionText, 1000, 200);
                            const points = [];

                            for (let i = 0; i < chunks.length; i++) {
                                const embedding = await embeddingService.generateEmbeddingWithRetry(chunks[i]);

                                points.push({
                                    id: `${refFile.type}_${sectionType}_chunk_${i}`,
                                    vector: embedding,
                                    payload: {
                                        type: refFile.type,
                                        section: sectionType,
                                        description: `${refFile.description} - ${sectionType}`,
                                        filename: refFile.filename,
                                        chunk_index: i,
                                        total_chunks: chunks.length,
                                        text: chunks[i],
                                        created_at: new Date().toISOString(),
                                    },
                                });
                            }

                            await qdrantClient.upsertPoints(this.collectionName, points);
                            logger.info(`${refFile.filename} [${sectionType}] ingested: ${chunks.length} chunks`);
                        }

                        results.push({
                            filename: refFile.filename,
                            type: refFile.type,
                            sections: Object.keys(sections),
                            total_chunks: Object.values(sections).reduce((sum, text) =>
                                sum + embeddingService.chunkText(text, 1000, 200).length, 0
                            ),
                            status: 'success'
                        });

                    } else {
                        // Regular processing for other documents
                        const chunks = embeddingService.chunkText(extractedText, 1000, 200);
                        const points = [];

                        // Generate embeddings and store
                        for (let i = 0; i < chunks.length; i++) {
                            const embedding = await embeddingService.generateEmbeddingWithRetry(chunks[i]);

                            points.push({
                                id: `${refFile.type}_chunk_${i}`,
                                vector: embedding,
                                payload: {
                                    type: refFile.type,
                                    description: refFile.description,
                                    filename: refFile.filename,
                                    chunk_index: i,
                                    total_chunks: chunks.length,
                                    text: chunks[i],
                                    created_at: new Date().toISOString(),
                                },
                            });
                        }

                        await qdrantClient.upsertPoints(this.collectionName, points);

                        results.push({
                            filename: refFile.filename,
                            type: refFile.type,
                            chunks: chunks.length,
                            status: 'success'
                        });

                        logger.info(`${refFile.filename} ingested: ${chunks.length} chunks`);
                    }

                } catch (error) {
                    logger.warn(`${refFile.filename} not found or failed: ${error.message}`);
                    results.push({
                        filename: refFile.filename,
                        type: refFile.type,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            logger.info('Reference documents ingestion completed');
            return results;

        } catch (error) {
            logger.error('Error ingesting reference documents:', error);
            throw error;
        }
    }

    // Extract CV and Project sections from unified scoring rubric
    extractScoringRubricSections(text) {
        const sections = {};

        // Section headers
        const cvSectionMatch = text.match(/CV Match Evaluation[\s\S]*?(?=Project Deliverable Evaluation|$)/i);
        const projectSectionMatch = text.match(/Project Deliverable Evaluation[\s\S]*?$/i);

        if (cvSectionMatch) {
            sections.cv_evaluation = cvSectionMatch[0].trim();
        }

        if (projectSectionMatch) {
            sections.project_evaluation = projectSectionMatch[0].trim();
        }

        // Fallback: if sections not found, split by common patterns
        if (!cvSectionMatch && !projectSectionMatch) {
            logger.warn('Could not detect scoring rubric sections, using full text for both');
            sections.cv_evaluation = text;
            sections.project_evaluation = text;
        }

        return sections;
    }

    // Search for relevant context from reference documents
    async searchContext(query, documentType = null, section = null, limit = 5) {
        try {
            const queryEmbedding = await embeddingService.generateEmbeddingWithRetry(query);

            // Build filter with section support
            let filter = null;

            if (documentType || section) {
                const conditions = [];

                if (documentType) {
                    conditions.push({
                        key: 'type',
                        match: { value: documentType }
                    });
                }

                if (section) {
                    conditions.push({
                        key: 'section',
                        match: { value: section }
                    });
                }

                filter = { must: conditions };
            }

            // Search in qdrant
            const results = await qdrantClient.search(
                this.collectionName,
                queryEmbedding,
                limit,
                filter
            );

            // Format result
            const formattedResults = results.map(result => ({
                text: result.payload.text,
                score: result.score,
                type: result.payload.type,
                section: result.payload.section || null,
                description: result.payload.description,
                chunk_index: result.payload.chunk_index,
                filename: result.payload.filename
            }));

            logger.info(`Found ${formattedResults.length} relevant contexts`);
            return formattedResults;

        } catch (error) {
            logger.error('Error searching context:', error);
            throw error;
        }
    }

    // Get all reference documents in vector store
    async listReferenceDocuments() {
        try {
            const points = await qdrantClient.scrollPoints(this.collectionName, 1000);

            // Group by document type
            const grouped = {};
            points.forEach(point => {
                const key = point.payload.section
                    ? `${point.payload.type}_${point.payload.section}`
                    : point.payload.type;

                if (!grouped[key]) {
                    grouped[key] = {
                        type: point.payload.type,
                        section: point.payload.section || null,
                        description: point.payload.description,
                        filename: point.payload.filename,
                        chunks: 0
                    };
                }
                grouped[key].chunks++;
            });

            return Object.values(grouped);
        } catch (error) {
            logger.error('Error listing reference documents:', error);
            throw error;
        }
    }

    // Delete all reference documents
    async clearReferenceDocuments() {
        try {
            await qdrantClient.deleteCollection(this.collectionName);
            await qdrantClient.createCollection(
                this.collectionName,
                embeddingService.getEmbeddingDimensions()
            );
            logger.info('All reference documents cleared');
        } catch (error) {
            logger.error('Error clearing reference documents:', error);
            throw error;
        }
    }

    // Get vector store statistics
    async getStatistics() {
        try {
            const count = await qdrantClient.countPoints(this.collectionName);
            const info = await qdrantClient.getCollectionInfo(this.collectionName);

            return {
                collection: this.collectionName,
                total_points: count,
                vector_size: info.config.params.vectors.size,
                distance: info.config.params.vectors.distance,
                status: info.status
            };
        } catch (error) {
            logger.error('Error getting statistics:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            await qdrantClient.client.getCollections();
            return { status: 'healthy', initialized: this.initialized };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

module.exports = new VectorStoreUseCase();