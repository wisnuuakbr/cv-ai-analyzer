const fs = require('fs');
const pdf = require('pdf-parse');

// Mock the dependencies before requiring pdfParser
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

jest.mock('pdf-parse', () => jest.fn());

const pdfParser = require('../../src/utils/pdfParser');

describe('PDFParser', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('extractText', () => {
        it('should extract text from PDF successfully', async () => {
            const mockPdfData = {
                text: 'Sample PDF text content',
                numpages: 2,
                info: { Title: 'Test PDF' },
                metadata: {},
                version: '1.7'
            };

            fs.promises.readFile.mockResolvedValue(Buffer.from('pdf content'));
            pdf.mockResolvedValue(mockPdfData);

            const result = await pdfParser.extractText('/path/to/test.pdf');

            expect(result).toEqual({
                text: 'Sample PDF text content',
                pages: 2,
                info: { Title: 'Test PDF' },
                metadata: {},
                version: '1.7'
            });
            expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/test.pdf');
        });

        it('should throw error when PDF parsing fails', async () => {
            fs.promises.readFile.mockResolvedValue(Buffer.from('invalid'));
            pdf.mockRejectedValue(new Error('Invalid PDF'));

            await expect(pdfParser.extractText('/path/to/invalid.pdf'))
                .rejects.toThrow('Failed to extract text from PDF');
        });
    });

    describe('cleanText', () => {
        it('should remove excessive whitespace', () => {
            const dirtyText = 'Hello    world   test';
            const cleaned = pdfParser.cleanText(dirtyText);
            expect(cleaned).toBe('Hello world test');
        });

        it('should remove excessive newlines', () => {
            const dirtyText = 'Line1\n\n\n\nLine2';
            const cleaned = pdfParser.cleanText(dirtyText);
            expect(cleaned).toBe('Line1\n\nLine2');
        });

        it('should handle empty text', () => {
            expect(pdfParser.cleanText('')).toBe('');
            expect(pdfParser.cleanText(null)).toBe('');
        });
    });

    describe('extractEmail', () => {
        it('should extract valid email', () => {
            const text = 'Contact me at john.doe@example.com for more info';
            const email = pdfParser.extractEmail(text);
            expect(email).toBe('john.doe@example.com');
        });

        it('should return null when no email found', () => {
            const text = 'No email here';
            const email = pdfParser.extractEmail(text);
            expect(email).toBeNull();
        });
    });

    describe('extractPhone', () => {
        it('should extract phone number', () => {
            const text = 'Call me at 123-456-7890';
            const phone = pdfParser.extractPhone(text);
            expect(phone).toBe('123-456-7890');
        });

        it('should return null when no phone found', () => {
            const text = 'No phone number';
            const phone = pdfParser.extractPhone(text);
            expect(phone).toBeNull();
        });
    });

    describe('extractSkills', () => {
        it('should extract technical skills', () => {
            const text = 'I am proficient in JavaScript, Python, React, and Docker';
            const skills = pdfParser.extractSkills(text);

            expect(skills).toContain('javascript');
            expect(skills).toContain('python');
            expect(skills).toContain('react');
            expect(skills).toContain('docker');
        });

        it('should return empty array when no skills found', () => {
            const text = 'Generic text without technical skills';
            const skills = pdfParser.extractSkills(text);
            expect(skills).toEqual([]);
        });
    });

    describe('extractCVData', () => {
        it('should extract structured CV data', async () => {
            const mockText = 'John Doe\njohn@example.com\n123-456-7890\nSkills: JavaScript, Python';

            fs.promises.readFile.mockResolvedValue(Buffer.from('pdf'));
            pdf.mockResolvedValue({ text: mockText, numpages: 1 });

            const result = await pdfParser.extractCVData('/path/to/cv.pdf');

            expect(result).toHaveProperty('rawText');
            expect(result).toHaveProperty('email', 'john@example.com');
            expect(result).toHaveProperty('phone', '123-456-7890');
            expect(result).toHaveProperty('skills');
            expect(result).toHaveProperty('wordCount');
            expect(result.skills).toContain('javascript');
            expect(result.skills).toContain('python');
        });
    });

    describe('extractProjectData', () => {
        it('should extract structured project data', async () => {
            const mockText = 'Project Report\nBuilt with Node.js and Express\nfunction test() {}';

            fs.promises.readFile.mockResolvedValue(Buffer.from('pdf'));
            pdf.mockResolvedValue({ text: mockText, numpages: 2 });

            const result = await pdfParser.extractProjectData('/path/to/project.pdf');

            expect(result).toHaveProperty('rawText');
            expect(result).toHaveProperty('codeBlocks');
            expect(result).toHaveProperty('technologies');
            expect(result).toHaveProperty('wordCount');
            expect(result.codeBlocks).toBeGreaterThan(0);
        });
    });

    describe('validatePDF', () => {
        it('should return true for valid PDF', async () => {
            const validPdfBuffer = Buffer.from('%PDF-1.4\nvalid content');
            fs.promises.readFile.mockResolvedValue(validPdfBuffer);
            pdf.mockResolvedValue({ text: 'content' });

            const isValid = await pdfParser.validatePDF('/path/to/valid.pdf');
            expect(isValid).toBe(true);
        });

        it('should return false for invalid PDF signature', async () => {
            const invalidBuffer = Buffer.from('Not a PDF');
            fs.promises.readFile.mockResolvedValue(invalidBuffer);

            const isValid = await pdfParser.validatePDF('/path/to/invalid.pdf');
            expect(isValid).toBe(false);
        });

        it('should return false when parsing fails', async () => {
            const validPdfBuffer = Buffer.from('%PDF-1.4');
            fs.promises.readFile.mockResolvedValue(validPdfBuffer);
            pdf.mockRejectedValue(new Error('Parse error'));

            const isValid = await pdfParser.validatePDF('/path/to/corrupt.pdf');
            expect(isValid).toBe(false);
        });
    });
});