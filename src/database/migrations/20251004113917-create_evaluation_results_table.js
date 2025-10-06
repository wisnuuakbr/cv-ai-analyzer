'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('evaluation_results', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				primaryKey: true,
				allowNull: false
			},
			evaluation_job_id: {
				type: Sequelize.UUID,
				allowNull: false,
				unique: true,
				references: {
					model: 'evaluation_jobs',
					key: 'id'
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE'
			},
			// CV Evaluation Results
			cv_match_rate: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true,
				comment: 'CV match rate (0.00 to 1.00)'
			},
			cv_feedback: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			cv_technical_skills_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			cv_experience_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			cv_achievements_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			cv_cultural_fit_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			// Project Evaluation Results
			project_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true,
				comment: 'Overall project score (1.00 to 5.00)'
			},
			project_feedback: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			project_correctness_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			project_code_quality_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			project_resilience_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			project_documentation_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			project_creativity_score: {
				type: Sequelize.DECIMAL(3, 2),
				allowNull: true
			},
			overall_summary: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
			}
		});

		// Add indexes
		await queryInterface.addIndex('evaluation_results', ['evaluation_job_id']);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('evaluation_results');
	}
};
