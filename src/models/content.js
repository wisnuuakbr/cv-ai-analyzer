const { Model, DataTypes } = require('sequelize');

class Content extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                    allowNull: false
                },
                document_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    unique: true,
                    field: 'document_id'
                },
                raw_text: {
                    type: DataTypes.TEXT('long'),
                    allowNull: false,
                    field: 'raw_text'
                },
                cleaned_text: {
                    type: DataTypes.TEXT('long'),
                    allowNull: true,
                    field: 'cleaned_text'
                },
                extracted_data: {
                    type: DataTypes.JSON,
                    allowNull: true,
                    field: 'extracted_data'
                },
                page_count: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    field: 'page_count'
                },
                word_count: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    field: 'word_count'
                },
                character_count: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    field: 'character_count'
                },
                extraction_status: {
                    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
                    defaultValue: 'pending',
                    allowNull: false,
                    field: 'extraction_status'
                },
                extraction_error: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    field: 'extraction_error'
                }
            },
            {
                sequelize,
                modelName: 'Content',
                tableName: 'contents',
                underscored: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
            }
        );
    }

    static associate(models) {
        // Belongs to document
        this.belongsTo(models.Document, {
            foreignKey: 'document_id',
            as: 'document'
        });
    }
}

module.exports = Content;