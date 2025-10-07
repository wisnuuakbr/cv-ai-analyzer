'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('evaluation_jobs', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				primaryKey: true,
				allowNull: false
			},
			job_title: {
				type: Sequelize.STRING,
				allowNull: false
			},
			cv_document_id: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'documents',
					key: 'id'
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE'
			},
			project_document_id: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'documents',
					key: 'id'
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE'
			},
			status: {
				type: Sequelize.ENUM('queued', 'processing', 'completed', 'failed'),
				defaultValue: 'queued',
				allowNull: false
			},
			error_message: {
				type: Sequelize.TEXT,
				allowNull: true
			},
			retry_count: {
				type: Sequelize.INTEGER,
				defaultValue: 0,
				allowNull: false
			},
			started_at: {
				type: Sequelize.DATE,
				allowNull: true
			},
			completed_at: {
				type: Sequelize.DATE,
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
		await queryInterface.addIndex('evaluation_jobs', ['status']);
		await queryInterface.addIndex('evaluation_jobs', ['cv_document_id']);
		await queryInterface.addIndex('evaluation_jobs', ['project_document_id']);
		await queryInterface.addIndex('evaluation_jobs', ['created_at']);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('evaluation_jobs');
	}
};
