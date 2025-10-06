module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/index.js',
        '!src/app.js',
        '!src/migrations/**',
        '!src/models/index.js',
        '!**/node_modules/**'
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};