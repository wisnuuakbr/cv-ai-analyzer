const { Model, DataTypes } = require('sequelize');

class EvaluationResult extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                    allowNull: false
                },
                evaluation_job_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    unique: true,
                    field: 'evaluation_job_id'
                },
                // CV Evaluation
                cv_match_rate: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'cv_match_rate'
                },
                cv_feedback: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    field: 'cv_feedback'
                },
                cv_technical_skills_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'cv_technical_skills_score'
                },
                cv_experience_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'cv_experience_score'
                },
                cv_achievements_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'cv_achievements_score'
                },
                cv_cultural_fit_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'cv_cultural_fit_score'
                },
                // Project Evaluation
                project_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'project_score'
                },
                project_feedback: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    field: 'project_feedback'
                },
                project_correctness_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'project_correctness_score'
                },
                project_code_quality_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'project_code_quality_score'
                },
                project_resilience_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'project_resilience_score'
                },
                project_documentation_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'project_documentation_score'
                },
                project_creativity_score: {
                    type: DataTypes.DECIMAL(3, 2),
                    allowNull: true,
                    field: 'project_creativity_score'
                },
                // Overall
                overall_summary: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    field: 'overall_summary'
                }
            },
            {
                sequelize,
                modelName: 'EvaluationResult',
                tableName: 'evaluation_results',
                underscored: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
            }
        );
    }

    static associate(models) {
        // Belongs to evaluation job
        this.belongsTo(models.EvaluationJob, {
            foreignKey: 'evaluation_job_id',
            as: 'evaluationJob'
        });
    }
}

module.exports = EvaluationResult;