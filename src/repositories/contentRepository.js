const { Content } = require('../models');
const logger = require('../utils/logger');

class ContentRepository {
    async create(data) {
        try {
            const content = await Content.create(data);
            logger.info(`Document content created for document: ${content.document_id}`);
            return content;
        } catch (error) {
            logger.error('Error creating document content:', error);
            throw error;
        }
    }

    async findByDocumentId(documentId) {
        try {
            const content = await Content.findOne({
                where: { document_id: documentId }
            });
            return content;
        } catch (error) {
            logger.error('Error finding document content:', error);
            throw error;
        }
    }

    async update(documentId, data) {
        try {
            const content = await Content.findOne({
                where: { document_id: documentId }
            });

            if (!content) {
                return null;
            }

            await content.update(data);
            logger.info(`Document content updated for document: ${documentId}`);
            return content;
        } catch (error) {
            logger.error('Error updating document content:', error);
            throw error;
        }
    }

    async upsert(data) {
        try {
            const [content, created] = await Content.upsert(data, {
                returning: true
            });
            logger.info(`Document content ${created ? 'created' : 'updated'} for document: ${data.document_id}`);
            return content;
        } catch (error) {
            logger.error('Error upserting document content:', error);
            throw error;
        }
    }

    async updateStatus(documentId, status, error = null) {
        try {
            const updateData = { extraction_status: status };
            if (error) {
                updateData.extraction_error = error;
            }
            return await this.update(documentId, updateData);
        } catch (error) {
            logger.error('Error updating content status:', error);
            throw error;
        }
    }
}

module.exports = new ContentRepository();