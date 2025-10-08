const qdrantClient = require('../utils/qdrantClient');
const embeddingService = require('../services/embeddingService');
const pdfParser = require('../utils/pdfParser');
const config = require('../config');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

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

    // Generate numeric ID for Qdrant (using hash)
    generatePointId(prefix, index) {
        const str = `${prefix}_${index}_${Date.now()}`;
        const hash = crypto.createHash('md5').update(str).digest('hex');
        // Convert first 8 characters of hex to number
        return parseInt(hash.substring(0, 8), 16);
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

                    // Log extracted text length for debugging
                    logger.info(`Extracted text length for ${refFile.filename}: ${extractedText.length} characters`);

                    // Log first 500 chars for debugging
                    logger.debug(`First 500 chars of ${refFile.filename}:\n${extractedText.substring(0, 500)}`);

                    // Handling scoring rubric based on file sections
                    if (refFile.type === 'scoring_rubric') {
                        const sections = this.extractScoringRubricSections(extractedText);
                        let totalChunks = 0;

                        // Log detected sections
                        logger.info(`Detected sections in ${refFile.filename}:`, Object.keys(sections));

                        for (const [sectionType, sectionText] of Object.entries(sections)) {
                            logger.info(`Section ${sectionType} length: ${sectionText.length} characters`);

                            // Use larger chunk size for rubric to avoid splitting tables
                            const chunks = embeddingService.chunkText(sectionText, 1500, 300);
                            const points = [];

                            for (let i = 0; i < chunks.length; i++) {
                                logger.info(`Generating embedding for ${refFile.filename} [${sectionType}] chunk ${i + 1}/${chunks.length}...`);

                                // Log chunk preview
                                logger.debug(`Chunk ${i + 1} preview (first 200 chars):\n${chunks[i].substring(0, 200)}`);

                                const embedding = await embeddingService.generateEmbeddingWithRetry(chunks[i]);

                                // Validate embedding
                                if (!Array.isArray(embedding) || embedding.length === 0) {
                                    throw new Error(`Invalid embedding generated for chunk ${i}`);
                                }

                                points.push({
                                    id: this.generatePointId(`${refFile.type}_${sectionType}`, i),
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

                            // Upsert in smaller batches
                            if (points.length > 0) {
                                await this.upsertPointsInBatches(points, 5);
                                totalChunks += chunks.length;
                                logger.info(`${refFile.filename} [${sectionType}] ingested: ${chunks.length} chunks`);
                            }
                        }

                        results.push({
                            filename: refFile.filename,
                            type: refFile.type,
                            sections: Object.keys(sections),
                            total_chunks: totalChunks,
                            chunks: totalChunks,
                            status: 'success'
                        });

                    } else {
                        // Regular processing for other documents
                        const chunks = embeddingService.chunkText(extractedText, 1000, 200);
                        const points = [];

                        // Generate embeddings and store
                        for (let i = 0; i < chunks.length; i++) {
                            logger.info(`Generating embedding for ${refFile.filename} chunk ${i + 1}/${chunks.length}...`);
                            const embedding = await embeddingService.generateEmbeddingWithRetry(chunks[i]);

                            // Validate embedding
                            if (!Array.isArray(embedding) || embedding.length === 0) {
                                throw new Error(`Invalid embedding generated for chunk ${i}`);
                            }

                            points.push({
                                id: this.generatePointId(refFile.type, i),
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

                        // Upsert in smaller batches
                        if (points.length > 0) {
                            await this.upsertPointsInBatches(points, 5);
                        }

                        results.push({
                            filename: refFile.filename,
                            type: refFile.type,
                            chunks: chunks.length,
                            status: 'success'
                        });

                        logger.info(`${refFile.filename} ingested: ${chunks.length} chunks`);
                    }

                } catch (error) {
                    logger.error(`${refFile.filename} failed:`, error);
                    logger.error('Error stack:', error.stack);
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

    // Upsert points in batches to avoid overload
    async upsertPointsInBatches(points, batchSize = 5) {
        for (let i = 0; i < points.length; i += batchSize) {
            const batch = points.slice(i, i + batchSize);
            try {
                logger.info(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}: ${batch.length} points`);
                await qdrantClient.upsertPoints(this.collectionName, batch);
                logger.info(`✓ Batch ${Math.floor(i / batchSize) + 1} upserted successfully`);
            } catch (error) {
                logger.error(`Error upserting batch at index ${i}:`, error);
                // Log first point for debugging
                if (batch.length > 0) {
                    logger.error('Sample point structure:', JSON.stringify({
                        id: batch[0].id,
                        id_type: typeof batch[0].id,
                        vector_length: batch[0].vector.length,
                        vector_type: typeof batch[0].vector[0],
                        payload_keys: Object.keys(batch[0].payload)
                    }, null, 2));
                }
                throw error;
            }
        }
    }

    // FIXED: Extract CV and Project sections from unified scoring rubric
    extractScoringRubricSections(text) {
        const sections = {};

        // Normalize text: remove extra whitespace and normalize line breaks
        const normalizedText = text.replace(/\s+/g, ' ').trim();

        logger.info('Attempting to extract scoring rubric sections...');
        logger.debug('Normalized text preview:', normalizedText.substring(0, 300));

        // FIXED: Updated patterns to match actual PDF structure
        // Pattern 1: Try to match "CV Match Evaluation" section
        const cvPattern = /CV Match Evaluation[^]*?(?=Project Deliverable Evaluation|$)/i;
        const cvMatch = normalizedText.match(cvPattern);

        // Pattern 2: Try to match "Project Deliverable Evaluation" section
        const projectPattern = /Project Deliverable Evaluation[^]*?$/i;
        const projectMatch = normalizedText.match(projectPattern);

        if (cvMatch) {
            sections.cv_evaluation = cvMatch[0].trim();
            logger.info(`✓ CV Evaluation section extracted: ${sections.cv_evaluation.length} chars`);
        } else {
            logger.warn('✗ CV Evaluation section not found, trying alternative extraction...');
        }

        if (projectMatch) {
            sections.project_evaluation = projectMatch[0].trim();
            logger.info(`✓ Project Evaluation section extracted: ${sections.project_evaluation.length} chars`);
        } else {
            logger.warn('✗ Project Evaluation section not found, trying alternative extraction...');
        }

        // Alternative approach: Look for table headers and parameters
        if (!cvMatch || !projectMatch) {
            logger.info('Using fallback extraction method based on keywords...');

            // Split by major section indicators
            const lines = text.split('\n');
            let cvSection = [];
            let projectSection = [];
            let currentSection = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Detect CV section
                if (line.match(/CV Match Evaluation|Technical Skills Match|Experience Level|Relevant Achievements|Cultural.*Fit/i)) {
                    currentSection = 'cv';
                }
                // Detect Project section
                else if (line.match(/Project Deliverable Evaluation|Correctness|Code Quality|Resilience|Documentation|Creativity/i)) {
                    currentSection = 'project';
                }

                // Add line to appropriate section
                if (currentSection === 'cv' && line.length > 0) {
                    cvSection.push(line);
                } else if (currentSection === 'project' && line.length > 0) {
                    projectSection.push(line);
                }
            }

            if (!sections.cv_evaluation && cvSection.length > 0) {
                sections.cv_evaluation = cvSection.join(' ');
                logger.info(`✓ CV Evaluation extracted via fallback: ${sections.cv_evaluation.length} chars`);
            }

            if (!sections.project_evaluation && projectSection.length > 0) {
                sections.project_evaluation = projectSection.join(' ');
                logger.info(`✓ Project Evaluation extracted via fallback: ${sections.project_evaluation.length} chars`);
            }
        }

        // Final fallback: if still nothing found, use full text for both
        if (Object.keys(sections).length === 0 ||
            (sections.cv_evaluation && sections.cv_evaluation.length < 100) ||
            (sections.project_evaluation && sections.project_evaluation.length < 100)) {

            logger.warn('⚠ Section extraction failed or sections too short, using full text for both sections');
            sections.cv_evaluation = text;
            sections.project_evaluation = text;
        }

        logger.info(`Final sections extracted: cv=${sections.cv_evaluation?.length || 0} chars, project=${sections.project_evaluation?.length || 0} chars`);

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

            // Log search results for debugging
            logger.info(`Search query: "${query.substring(0, 50)}..."`);
            logger.info(`Found ${results.length} results`);

            if (results.length > 0) {
                logger.debug('Top result score:', results[0].score);
                logger.debug('Top result preview:', results[0].payload.text.substring(0, 100));
            }

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

    // Helper methods for CV and Project scoring context retrieval
    async searchCVScoringContext(query, limit = 5) {
        return this.searchContext(query, 'scoring_rubric', 'cv_evaluation', limit);
    }

    async searchProjectScoringContext(query, limit = 5) {
        return this.searchContext(query, 'scoring_rubric', 'project_evaluation', limit);
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