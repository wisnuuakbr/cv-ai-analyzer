// Jest setup file
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'cv_ai_analyzer_test';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'password';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.HUGGINGFACE_API_KEY = 'test_key';
process.env.QDRANT_HOST = 'localhost';
process.env.QDRANT_PORT = '6333';

// Mock logger to avoid console noise during tests
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

// Increase timeout for async tests
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
    // Helper to wait for async operations
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Helper to create mock request
    createMockRequest: (overrides = {}) => ({
        body: {},
        params: {},
        query: {},
        headers: {},
        ...overrides
    }),

    // Helper to create mock response
    createMockResponse: () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        res.sendStatus = jest.fn().mockReturnValue(res);
        return res;
    },

    // Helper to create mock next function
    createMockNext: () => jest.fn()
};

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
    console.error = (...args) => {
        if (
            typeof args[0] === 'string' &&
            args[0].includes('Warning: ReactDOM.render')
        ) {
            return;
        }
        originalError.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalError;
});

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});