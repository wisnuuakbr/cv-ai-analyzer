const { Model, DataTypes } = require('sequelize');

class EvaluationJob extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                    allowNull: false
                },
                job_title: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    field: 'job_title'
                },
                cv_document_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    field: 'cv_document_id'
                },
                project_document_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    field: 'project_document_id'
                },
                status: {
                    type: DataTypes.ENUM('queued', 'processing', 'completed', 'failed'),
                    defaultValue: 'queued',
                    allowNull: false
                },
                error_message: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    field: 'error_message'
                },
                retry_count: {
                    type: DataTypes.INTEGER,
                    defaultValue: 0,
                    allowNull: false,
                    field: 'retry_count'
                },
                started_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    field: 'started_at'
                },
                completed_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    field: 'completed_at'
                }
            },
            {
                sequelize,
                modelName: 'EvaluationJob',
                tableName: 'evaluation_jobs',
                underscored: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
            }
        );
    }

    static associate(models) {
        // Belongs to CV document
        this.belongsTo(models.Document, {
            foreignKey: 'cv_document_id',
            as: 'cvDocument'
        });

        // Belongs to Project Report document
        this.belongsTo(models.Document, {
            foreignKey: 'project_document_id',
            as: 'projectDocument'
        });

        // Has one evaluation result
        this.hasOne(models.EvaluationResult, {
            foreignKey: 'evaluation_job_id',
            as: 'result'
        });
    }
}

module.exports = EvaluationJob;