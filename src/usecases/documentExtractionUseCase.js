const pdfParser = require('../utils/pdfParser');
const documentRepository = require('../repositories/documentRepository');
const contentRepository = require('../repositories/contentRepository');
const logger = require('../utils/logger');
const { AppError } = require('../middlewares/errorHandler');

class DocumentExtractionUseCase {
    // Extract text from document
    async extractDocument(documentId) {
        try {
            logger.info(`Starting extraction for document: ${documentId}`);

            // Get document
            const document = await documentRepository.findById(documentId);
            if (!document) {
                throw new AppError('Document not found', 404);
            }

            // Update extraction status to processing
            await contentRepository.upsert({
                document_id: documentId,
                extraction_status: 'processing',
                raw_text: '',
            });

            // Extract based on document type
            let extractedData;
            if (document.file_type === 'cv') {
                extractedData = await pdfParser.extractCVData(document.file_path);
            } else if (document.file_type === 'project_report') {
                extractedData = await pdfParser.extractProjectData(document.file_path);
            } else {
                throw new Error('Invalid document type');
            }

            // Parse PDF info
            const pdfInfo = await pdfParser.extractText(document.file_path);

            // Save to database
            const contentData = {
                document_id: documentId,
                raw_text: extractedData.rawText,
                cleaned_text: extractedData.rawText,
                extracted_data: {
                    sections: extractedData.sections,
                    email: extractedData.email,
                    phone: extractedData.phone,
                    skills: extractedData.skills,
                    technologies: extractedData.technologies,
                    codeBlocks: extractedData.codeBlocks,
                },
                page_count: pdfInfo.pages,
                word_count: extractedData.wordCount,
                character_count: extractedData.characterCount,
                extraction_status: 'completed',
            };

            await contentRepository.upsert(contentData);

            // Update document status to processed
            await documentRepository.update(documentId, {
                upload_status: 'processed'
            });

            logger.info(`Extraction completed for document: ${documentId}`);

            return {
                documentId,
                status: 'completed',
                pages: pdfInfo.pages,
                wordCount: extractedData.wordCount,
                characterCount: extractedData.characterCount
            };

        } catch (error) {
            logger.error(`Error extracting document ${documentId}:`, error);

            // Update status to failed
            await contentRepository.updateStatus(
                documentId,
                'failed',
                error.message
            );

            // Update document status
            await documentRepository.update(documentId, {
                upload_status: 'failed'
            });

            throw error;
        }
    }

    // Extract multiple documents in parallel
    async extractMultipleDocuments(documentIds) {
        const results = [];

        // Process in parallel
        const promises = documentIds.map(async (documentId) => {
            try {
                const result = await this.extractDocument(documentId);
                return { documentId, success: true, ...result };
            } catch (error) {
                return {
                    documentId,
                    success: false,
                    error: error.message
                };
            }
        });

        const completed = await Promise.allSettled(promises);

        completed.forEach((result) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                results.push({
                    documentId: 'unknown',
                    success: false,
                    error: result.reason.message
                });
            }
        });

        return results;
    }

    // Get extracted content by document ID
    async getExtractedContent(documentId) {
        try {
            const content = await contentRepository.findByDocumentId(documentId);

            if (!content) {
                throw new AppError('Content not found for document', 404);
            }

            return {
                documentId: content.document_id,
                status: content.extraction_status,
                text: content.cleaned_text,
                extractedData: content.extracted_data,
                pageCount: content.page_count,
                wordCount: content.word_count,
                characterCount: content.character_count,
                error: content.extraction_error
            };
        } catch (error) {
            logger.error('Error getting extracted content:', error);
            throw error;
        }
    }

    // Retry extraction for failed document
    async retryExtraction(documentId) {
        try {
            logger.info(`Retrying extraction for document: ${documentId}`);

            // Reset status to pending
            await contentRepository.updateStatus(documentId, 'pending', null);

            // Extract again
            return await this.extractDocument(documentId);
        } catch (error) {
            logger.error('Error retrying extraction:', error);
            throw error;
        }
    }

    // Validate PDF before extraction
    async validatePDF(documentId) {
        try {
            const document = await documentRepository.findById(documentId);
            if (!document) {
                throw new AppError('Document not found', 404);
            }

            const isValid = await pdfParser.validatePDF(document.file_path);
            return isValid;
        } catch (error) {
            logger.error('Error validating PDF:', error);
            throw error;
        }
    }
}

module.exports = new DocumentExtractionUseCase();