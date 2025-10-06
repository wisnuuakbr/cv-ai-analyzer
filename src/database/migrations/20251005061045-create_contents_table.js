'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('contents', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				primaryKey: true,
				allowNull: false
			},
			document_id: {
				type: Sequelize.UUID,
				allowNull: false,
				unique: true,
				references: {
					model: 'documents',
					key: 'id'
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE'
			},
			raw_text: {
				type: Sequelize.TEXT('long'),
				allowNull: false
			},
			cleaned_text: {
				type: Sequelize.TEXT('long'),
				allowNull: true
			},
			extracted_data: {
				type: Sequelize.JSON,
				allowNull: true,
				comment: 'Structured data extracted from document'
			},
			page_count: {
				type: Sequelize.INTEGER,
				allowNull: true
			},
			word_count: {
				type: Sequelize.INTEGER,
				allowNull: true
			},
			character_count: {
				type: Sequelize.INTEGER,
				allowNull: true
			},
			extraction_status: {
				type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
				defaultValue: 'pending',
				allowNull: false
			},
			extraction_error: {
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
		await queryInterface.addIndex('contents', ['document_id']);
		await queryInterface.addIndex('contents', ['extraction_status']);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('contents');
	}
};
