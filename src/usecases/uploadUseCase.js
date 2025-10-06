const fs = require('fs').promises;
const path = require('path');
const documentRepository = require('../repositories/documentRepository');
const logger = require('../utils/logger');
const { AppError } = require('../middlewares/errorHandler');
const documentExtractionUseCase = require('./documentExtractionUseCase');

class UploadUseCase {
    async uploadDocuments(files) {
        try {
            const { cv, project_report } = files;

            // Process cv file
            const cvData = {
                filename: cv[0].filename,
                original_name: cv[0].originalname,
                file_path: cv[0].path,
                file_type: 'cv',
                mime_type: cv[0].mimetype,
                file_size: cv[0].size,
                upload_status: 'uploaded'
            };

            const cvDocument = await documentRepository.create(cvData);

            // Process project report file
            const projectData = {
                filename: project_report[0].filename,
                original_name: project_report[0].originalname,
                file_path: project_report[0].path,
                file_type: 'project_report',
                mime_type: project_report[0].mimetype,
                file_size: project_report[0].size,
                upload_status: 'uploaded'
            };

            const projectDocument = await documentRepository.create(projectData);

            logger.info(`Documents uploaded successfully - CV: ${cvDocument.id}, Project: ${projectDocument.id}`);

            // Auto extract with trigger extraction in background
            this.triggerAutoExtraction([cvDocument.id, projectDocument.id]);

            return {
                cv: {
                    id: cvDocument.id,
                    filename: cvDocument.original_name,
                    size: cvDocument.file_size
                },
                project_report: {
                    id: projectDocument.id,
                    filename: projectDocument.original_name,
                    size: projectDocument.file_size
                }
            };
        } catch (error) {
            logger.error('Error in uploadDocuments:', error);

            // Cleanup uploaded files if database operation fails
            await this.cleanupFiles(files);

            throw error;
        }
    }

    // Trigger automatic extraction in background
    async triggerAutoExtraction(documentIds) {
        // Run in background without blocking response
        setImmediate(async () => {
            try {
                logger.info('Auto-extracting documents:', documentIds);

                for (const docId of documentIds) {
                    try {
                        await documentExtractionUseCase.extractDocument(docId);
                        logger.info(`Auto-extraction completed for: ${docId}`);
                    } catch (error) {
                        logger.error(`Auto-extraction failed for ${docId}:`, error);
                        // Continue with next document even if one fails
                    }
                }
            } catch (error) {
                logger.error('Error in auto-extraction:', error);
            }
        });
    }

    async validateDocuments(cvId, projectId) {
        try {
            const documents = await documentRepository.findByIds([cvId, projectId]);

            if (documents.length !== 2) {
                throw new AppError('One or both documents not found', 404);
            }

            const cvDoc = documents.find(doc => doc.id === cvId);
            const projectDoc = documents.find(doc => doc.id === projectId);

            if (!cvDoc) {
                throw new AppError('CV document not found', 404);
            }

            if (!projectDoc) {
                throw new AppError('Project report document not found', 404);
            }

            if (cvDoc.file_type !== 'cv') {
                throw new AppError('Invalid document type for CV', 400);
            }

            if (projectDoc.file_type !== 'project_report') {
                throw new AppError('Invalid document type for project report', 400);
            }

            // Check if extraction completed
            if (cvDoc.upload_status === 'failed' || projectDoc.upload_status === 'failed') {
                throw new AppError('One or both documents failed to process', 400);
            }

            return { cvDoc, projectDoc };
        } catch (error) {
            logger.error('Error in validateDocuments:', error);
            throw error;
        }
    }

    // Cleanup uploaded files on error
    async cleanupFiles(files) {
        try {
            if (files.cv && files.cv[0]) {
                await fs.unlink(files.cv[0].path);
                logger.info(`Cleaned up CV file: ${files.cv[0].filename}`);
            }
            if (files.project_report && files.project_report[0]) {
                await fs.unlink(files.project_report[0].path);
                logger.info(`Cleaned up project file: ${files.project_report[0].filename}`);
            }
        } catch (unlinkError) {
            logger.error('Error cleaning up files:', unlinkError);
        }
    }
}

module.exports = new UploadUseCase();