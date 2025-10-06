const fs = require('fs').promises;
const pdf = require('pdf-parse');
const logger = require('./logger');

class PDFParser {
    // Extract txt from PDF
    async extractText(filePath) {
        try {
            logger.info(`Extracting text from PDF: ${filePath}`);

            // Read file
            const dataBuffer = await fs.readFile(filePath);

            // Parse PDF
            const data = await pdf(dataBuffer);

            const result = {
                text: data.text,
                pages: data.numpages,
                info: data.info,
                metadata: data.metadata,
                version: data.version
            };

            logger.info(`PDF parsed successfully: ${data.numpages} pages, ${data.text.length} characters`);

            return result;
        } catch (error) {
            logger.error(`Error extracting text from PDF ${filePath}:`, error);
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    // Extract txt with cleaning
    async extractCleanText(filePath) {
        try {
            const result = await this.extractText(filePath);
            const cleanText = this.cleanText(result.text);
            return cleanText;
        } catch (error) {
            logger.error('Error extracting clean text:', error);
            throw error;
        }
    }

    // Clean extracted text
    cleanText(text) {
        if (!text) return '';

        let cleaned = text;

        // Remove excessive whitespace
        cleaned = cleaned.replace(/\s+/g, ' ');

        // Remove excessive newlines (keep max 2)
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        // Trim
        cleaned = cleaned.trim();

        return cleaned;
    }

    //    Extract structured data 
    async extractCVData(filePath) {
        try {
            const text = await this.extractCleanText(filePath);

            // Basic extraction (can be enhanced with NLP later)
            const cvData = {
                rawText: text,
                sections: this.extractSections(text),
                email: this.extractEmail(text),
                phone: this.extractPhone(text),
                skills: this.extractSkills(text),
                wordCount: text.split(/\s+/).length,
                characterCount: text.length
            };

            logger.info('CV data extracted successfully');
            return cvData;
        } catch (error) {
            logger.error('Error extracting CV data:', error);
            throw error;
        }
    }

    // Extract structured data from Project Report
    async extractProjectData(filePath) {
        try {
            const text = await this.extractCleanText(filePath);

            const projectData = {
                rawText: text,
                sections: this.extractSections(text),
                codeBlocks: this.extractCodeBlocks(text),
                technologies: this.extractTechnologies(text),
                wordCount: text.split(/\s+/).length,
                characterCount: text.length
            };

            logger.info('Project data extracted successfully');
            return projectData;
        } catch (error) {
            logger.error('Error extracting project data:', error);
            throw error;
        }
    }

    // Extract sections from text
    extractSections(text) {
        const sections = [];

        // Common section patterns
        const sectionPatterns = [
            /^([A-Z][A-Z\s]{2,}):?$/gm,  // ALL CAPS headings
            /^([A-Z][a-z\s]{2,}):$/gm,    // Title Case with colon
            /^\d+\.\s+([A-Z][a-z\s]+)$/gm // Numbered sections
        ];

        sectionPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                sections.push(match[1].trim());
            }
        });

        return [...new Set(sections)]; // Remove duplicates
    }

    // Extract email from text
    extractEmail(text) {
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const match = text.match(emailPattern);
        return match ? match[0] : null;
    }

    // Extract phone from text
    extractPhone(text) {
        const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
        const match = text.match(phonePattern);
        return match ? match[0] : null;
    }

    // Extract technical skills from text
    extractSkills(text) {
        const skills = [];
        const lowerText = text.toLowerCase();

        // Common technical skills to look for
        const skillKeywords = [
            'javascript', 'typescript', 'python', 'java', 'golang', 'php', 'ruby',
            'node.js', 'express', 'react', 'vue', 'angular', 'next.js',
            'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
            'docker', 'kubernetes', 'aws', 'gcp', 'azure',
            'git', 'ci/cd', 'jenkins', 'github actions',
            'rest api', 'graphql', 'microservices', 'websocket',
            'llm', 'ai', 'machine learning', 'nlp', 'rag'
        ];

        skillKeywords.forEach(skill => {
            if (lowerText.includes(skill.toLowerCase())) {
                skills.push(skill);
            }
        });

        return skills;
    }

    // Extract code blocks from text
    extractCodeBlocks(text) {
        // Look for common code indicators
        const codePatterns = [
            /```[\s\S]*?```/g,  // Markdown code blocks
            /function\s+\w+\s*\(/g,  // Function declarations
            /class\s+\w+/g,  // Class declarations
            /const\s+\w+\s*=/g,  // Const declarations
            /import\s+.*from/g,  // Import statements
        ];

        let count = 0;
        codePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) count += matches.length;
        });

        return count;
    }

    // Extract technologies mentioned in text
    extractTechnologies(text) {
        const technologies = [];
        const lowerText = text.toLowerCase();

        const techKeywords = [
            'express', 'fastify', 'nest.js',
            'sequelize', 'typeorm', 'prisma',
            'jest', 'mocha', 'chai',
            'webpack', 'vite', 'babel',
            'nginx', 'apache',
            'rabbitmq', 'kafka',
            'prometheus', 'grafana',
            'terraform', 'ansible'
        ];

        techKeywords.forEach(tech => {
            if (lowerText.includes(tech.toLowerCase())) {
                technologies.push(tech);
            }
        });

        return technologies;
    }

    // Validate PDF file
    async validatePDF(filePath) {
        try {
            const dataBuffer = await fs.readFile(filePath);

            // Check PDF signature
            const signature = dataBuffer.slice(0, 5).toString();
            if (!signature.startsWith('%PDF-')) {
                return false;
            }

            // Try to parse
            await pdf(dataBuffer);
            return true;
        } catch (error) {
            logger.error('PDF validation failed:', error);
            return false;
        }
    }
}

module.exports = new PDFParser();