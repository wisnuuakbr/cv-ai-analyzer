const { Model, DataTypes } = require('sequelize');

class Document extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                    allowNull: false
                },
                filename: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                original_name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    field: 'original_name'
                },
                file_path: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    field: 'file_path'
                },
                file_type: {
                    type: DataTypes.ENUM('cv', 'project_report'),
                    allowNull: false,
                    field: 'file_type'
                },
                mime_type: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    field: 'mime_type'
                },
                file_size: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    field: 'file_size'
                },
                upload_status: {
                    type: DataTypes.ENUM('uploaded', 'processed', 'failed'),
                    defaultValue: 'uploaded',
                    allowNull: false,
                    field: 'upload_status'
                }
            },
            {
                sequelize,
                modelName: 'Document',
                tableName: 'documents',
                underscored: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
            }
        );
    }

    static associate(models) {
        // Referenced by many evaluation jobs
        this.hasMany(models.EvaluationJob, {
            foreignKey: 'cv_document_id',
            as: 'cvEvaluations'
        });

        this.hasMany(models.EvaluationJob, {
            foreignKey: 'project_document_id',
            as: 'projectEvaluations'
        });

        // Has one content
        this.hasOne(models.Content, {
            foreignKey: 'document_id',
            as: 'content'
        });
    }
}

module.exports = Document;