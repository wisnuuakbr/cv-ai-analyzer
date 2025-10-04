'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('documents', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            filename: {
                type: Sequelize.STRING,
                allowNull: false
            },
            original_name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            file_path: {
                type: Sequelize.STRING,
                allowNull: false
            },
            file_type: {
                type: Sequelize.ENUM('cv', 'project_report'),
                allowNull: false
            },
            mime_type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            file_size: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            upload_status: {
                type: Sequelize.ENUM('uploaded', 'processed', 'failed'),
                defaultValue: 'uploaded',
                allowNull: false
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
        await queryInterface.addIndex('documents', ['file_type']);
        await queryInterface.addIndex('documents', ['upload_status']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('documents');
    }
};
