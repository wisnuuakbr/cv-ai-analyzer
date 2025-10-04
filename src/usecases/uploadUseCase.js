const fs = require('fs').promises;
const path = require('path');
const documentRepository = require('../repositories/documentRepository');
const logger = require('../utils/logger');
const { AppError } = require('../middlewares/errorHandler');

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
            try {
                if (files.cv && files.cv[0]) {
                    await fs.unlink(files.cv[0].path);
                }
                if (files.project_report && files.project_report[0]) {
                    await fs.unlink(files.project_report[0].path);
                }
            } catch (unlinkError) {
                logger.error('Error cleaning up files:', unlinkError);
            }

            throw error;
        }
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

            return { cvDoc, projectDoc };
        } catch (error) {
            logger.error('Error in validateDocuments:', error);
            throw error;
        }
    }
}

module.exports = new UploadUseCase();