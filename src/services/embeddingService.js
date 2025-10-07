const { HfInference } = require('@huggingface/inference');
const config = require('../config');
const logger = require('../utils/logger');

class EmbeddingService {
    constructor() {
        this.hf = null;
        this.model = 'BAAI/bge-small-en-v1.5';
        this.initialized = false;
    }

    // Initialize HuggingFace client
    initialize() {
        try {
            if (!config.huggingface.apiKey) {
                throw new Error('HuggingFace API key not configured');
            }

            this.hf = new HfInference(config.huggingface.apiKey);
            this.initialized = true;

            logger.info('Embedding service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize embedding service:', error);
            throw error;
        }
    }

    // Generate embedding for text
    async generateEmbedding(text) {
        try {
            if (!this.initialized) {
                this.initialize();
            }

            if (!text || text.trim().length === 0) {
                throw new Error('Text cannot be empty');
            }

            // Truncate text if too long (model limit: ~512 tokens)
            const truncatedText = this.truncateText(text, 512);

            logger.debug(`Generating embedding for text: ${truncatedText.substring(0, 50)}...`);

            // Generate embedding using HuggingFace
            const embedding = await this.hf.featureExtraction({
                model: this.model,
                inputs: truncatedText,
            });

            // HF returns array, we need flat array
            const flatEmbedding = Array.isArray(embedding[0]) ? embedding[0] : embedding;

            logger.debug(`Generated embedding with ${flatEmbedding.length} dimensions`);

            return flatEmbedding;
        } catch (error) {
            logger.error('Error generating embedding:', error);

            // Return fallback zero vector if API fails
            logger.warn('Using fallback zero vector');
            return new Array(384).fill(0);
        }
    }

    // Generate embeddings for multiple texts
    async generateEmbeddings(texts) {
        try {
            const embeddings = await Promise.all(
                texts.map(text => this.generateEmbedding(text))
            );

            logger.info(`Generated ${embeddings.length} embeddings`);
            return embeddings;
        } catch (error) {
            logger.error('Error generating multiple embeddings:', error);
            throw error;
        }
    }

    // Generate embedding with retry logic
    async generateEmbeddingWithRetry(text, maxRetries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.generateEmbedding(text);
            } catch (error) {
                lastError = error;
                logger.warn(`Embedding generation attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    logger.info(`Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        logger.error(`All ${maxRetries} attempts failed`);
        throw lastError;
    }

    // Truncate text to approximate token limit
    truncateText(text, maxTokens = 512) {
        // Rough approximation: 1 token ≈ 4 characters
        const maxChars = maxTokens * 4;

        if (text.length <= maxChars) {
            return text;
        }

        // Truncate and add ellipsis
        return text.substring(0, maxChars - 3) + '...';
    }

    // Chunk text into smaller pieces
    chunkText(text, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            const end = start + chunkSize;
            const chunk = text.substring(start, end);
            chunks.push(chunk);

            start = end - overlap;
        }

        logger.info(`Text chunked into ${chunks.length} pieces`);
        return chunks;
    }

    // Sleep helper for retry logic
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get embedding dimensions
    getEmbeddingDimensions() {
        return 384;
    }
}

// Singleton instance
const embeddingService = new EmbeddingService();

module.exports = embeddingService;