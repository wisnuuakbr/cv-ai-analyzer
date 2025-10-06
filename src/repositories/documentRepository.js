const { Document } = require('../models');
const logger = require('../utils/logger');

class DocumentRepository {
    async create(data) {
        try {
            const document = await Document.create(data);
            logger.info(`Document created: ${document.id}`);
            return document;
        } catch (error) {
            logger.error('Error creating document:', error);
            throw error;
        }
    }

    async findById(id) {
        try {
            const document = await Document.findByPk(id);
            return document;
        } catch (error) {
            logger.error('Error finding document by id:', error);
            throw error;
        }
    }

    async findByIds(ids) {
        try {
            const documents = await Document.findAll({
                where: {
                    id: ids
                }
            });
            return documents;
        } catch (error) {
            logger.error('Error finding documents:', error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            const document = await Document.findByPk(id);
            if (!document) {
                return null;
            }
            await document.update(data);
            logger.info(`Document updated: ${id}`);
            return document;
        } catch (error) {
            logger.error('Error updating document:', error);
            throw error;
        }
    }
}

module.exports = new DocumentRepository();