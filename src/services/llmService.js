const { HfInference } = require('@huggingface/inference');
const config = require('../config');
const logger = require('../utils/logger');

class LLMService {
    constructor() {
        this.hf = null;
        this.model = config.huggingface.model;
        this.temperature = config.huggingface.temperature;
        this.maxTokens = config.huggingface.maxTokens;
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

            logger.info('LLM service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize LLM service:', error);
            throw error;
        }
    }

    //  Generate text completion
    async generateText(prompt, options = {}) {
        try {
            if (!this.initialized) {
                this.initialize();
            }

            logger.debug('Generating text with prompt length:', prompt.length);

            const response = await this.hf.textGeneration({
                model: options.model || this.model,
                inputs: prompt,
                parameters: {
                    max_new_tokens: options.maxTokens || this.maxTokens,
                    temperature: options.temperature || this.temperature,
                    top_p: options.topP || 0.95,
                    return_full_text: false,
                },
            });

            const generatedText = response.generated_text.trim();
            logger.debug('Generated text length:', generatedText.length);

            return generatedText;
        } catch (error) {
            logger.error('Error generating text:', error);
            throw error;
        }
    }

    // Generate text with retry
    async generateTextWithRetry(prompt, options = {}, maxRetries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.generateText(prompt, options);
            } catch (error) {
                lastError = error;
                logger.warn(`Text generation attempt ${attempt} failed:`, error.message);

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

    // Parse JSON from LLM response
    parseJSON(text) {
        try {
            // Try to find JSON in the text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // If no JSON found, try parsing the whole text
            return JSON.parse(text);
        } catch (error) {
            logger.error('Failed to parse JSON from LLM response:', error);
            logger.debug('Response text:', text);
            throw new Error('Invalid JSON response from LLM');
        }
    }

    // Extract score from text
    extractScore(text, min = 1, max = 5) {
        // Look for patterns like "Score: 4" or "4/5" or "4.5"
        const patterns = [
            /(?:score|rating):\s*(\d+(?:\.\d+)?)/i,
            /(\d+(?:\.\d+)?)\s*\/\s*\d+/,
            /\b(\d+(?:\.\d+)?)\b/
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const score = parseFloat(match[1]);
                if (score >= min && score <= max) {
                    return score;
                }
            }
        }

        logger.warn('Could not extract valid score from text:', text);
        return null;
    }

    // Sleep helper
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Build evaluation prompt
    buildPrompt(systemPrompt, context, query) {
        return `${systemPrompt}

            Context:
            ${context}

            ${query}

            Please provide your evaluation:
        `;
    }
}

// Singleton instance
const llmService = new LLMService();

module.exports = llmService;