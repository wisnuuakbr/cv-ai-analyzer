const uploadUseCase = require('../../src/usecases/uploadUseCase');
const documentRepository = require('../../src/repositories/documentRepository');
const documentExtractionUseCase = require('../../src/usecases/documentExtractionUseCase');
const fs = require('fs');

jest.mock('../../src/repositories/documentRepository');
jest.mock('../../src/usecases/documentExtractionUseCase');

// Mock the fs.promises module properly
jest.mock('fs', () => ({
    promises: {
        unlink: jest.fn()
    }
}));

describe('UploadUseCase', () => {
    const mockFiles = {
        cv: [{
            filename: 'cv_123.pdf',
            originalname: 'my_cv.pdf',
            path: '/uploads/cv_123.pdf',
            mimetype: 'application/pdf',
            size: 1024000
        }],
        project_report: [{
            filename: 'project_456.pdf',
            originalname: 'my_project.pdf',
            path: '/uploads/project_456.pdf',
            mimetype: 'application/pdf',
            size: 2048000
        }]
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(global, 'setImmediate').mockImplementation((fn) => fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('uploadDocuments', () => {
        it('should upload CV and project report successfully', async () => {
            const mockCvDoc = {
                id: 'cv-uuid-123',
                original_name: 'my_cv.pdf',
                file_size: 1024000
            };
            const mockProjectDoc = {
                id: 'project-uuid-456',
                original_name: 'my_project.pdf',
                file_size: 2048000
            };

            documentRepository.create
                .mockResolvedValueOnce(mockCvDoc)
                .mockResolvedValueOnce(mockProjectDoc);

            documentExtractionUseCase.extractDocument.mockResolvedValue({});

            const result = await uploadUseCase.uploadDocuments(mockFiles);

            expect(result).toEqual({
                cv: {
                    id: 'cv-uuid-123',
                    filename: 'my_cv.pdf',
                    size: 1024000
                },
                project_report: {
                    id: 'project-uuid-456',
                    filename: 'my_project.pdf',
                    size: 2048000
                }
            });

            expect(documentRepository.create).toHaveBeenCalledTimes(2);
            expect(documentRepository.create).toHaveBeenCalledWith({
                filename: 'cv_123.pdf',
                original_name: 'my_cv.pdf',
                file_path: '/uploads/cv_123.pdf',
                file_type: 'cv',
                mime_type: 'application/pdf',
                file_size: 1024000,
                upload_status: 'uploaded'
            });
        });

        it('should trigger auto-extraction in background', async () => {
            const mockCvDoc = { id: 'cv-uuid', filename: 'cv.pdf', original_name: 'cv.pdf', file_size: 1024 };
            const mockProjectDoc = { id: 'project-uuid', filename: 'project.pdf', original_name: 'project.pdf', file_size: 2048 };

            documentRepository.create
                .mockResolvedValueOnce(mockCvDoc)
                .mockResolvedValueOnce(mockProjectDoc);

            documentExtractionUseCase.extractDocument.mockResolvedValue({});

            await uploadUseCase.uploadDocuments(mockFiles);

            // setImmediate is mocked to run immediately
            expect(documentExtractionUseCase.extractDocument).toHaveBeenCalledWith('cv-uuid');
            expect(documentExtractionUseCase.extractDocument).toHaveBeenCalledWith('project-uuid');
        });

        it('should cleanup files when database operation fails', async () => {
            documentRepository.create.mockRejectedValue(new Error('Database error'));
            fs.promises.unlink.mockResolvedValue();

            await expect(uploadUseCase.uploadDocuments(mockFiles)).rejects.toThrow('Database error');

            expect(fs.promises.unlink).toHaveBeenCalledWith('/uploads/cv_123.pdf');
            expect(fs.promises.unlink).toHaveBeenCalledWith('/uploads/project_456.pdf');
        });
    });

    describe('validateDocuments', () => {
        it('should validate documents successfully', async () => {
            const mockDocs = [
                { id: 'cv-id', file_type: 'cv', upload_status: 'processed' },
                { id: 'project-id', file_type: 'project_report', upload_status: 'processed' }
            ];

            documentRepository.findByIds.mockResolvedValue(mockDocs);

            const result = await uploadUseCase.validateDocuments('cv-id', 'project-id');

            expect(result).toEqual({
                cvDoc: mockDocs[0],
                projectDoc: mockDocs[1]
            });
        });

        it('should throw error when documents not found', async () => {
            documentRepository.findByIds.mockResolvedValue([]);

            await expect(uploadUseCase.validateDocuments('cv-id', 'project-id'))
                .rejects.toThrow('One or both documents not found');
        });

        it('should throw error when CV document not found', async () => {
            documentRepository.findByIds.mockResolvedValue([
                { id: 'project-id', file_type: 'project_report' }
            ]);

            await expect(uploadUseCase.validateDocuments('cv-id', 'project-id'))
                .rejects.toThrow('One or both documents not found');
        });

        it('should throw error when document type is invalid', async () => {
            documentRepository.findByIds.mockResolvedValue([
                { id: 'cv-id', file_type: 'wrong_type' },
                { id: 'project-id', file_type: 'project_report' }
            ]);

            await expect(uploadUseCase.validateDocuments('cv-id', 'project-id'))
                .rejects.toThrow('Invalid document type for CV');
        });

        it('should throw error when document processing failed', async () => {
            documentRepository.findByIds.mockResolvedValue([
                { id: 'cv-id', file_type: 'cv', upload_status: 'failed' },
                { id: 'project-id', file_type: 'project_report', upload_status: 'processed' }
            ]);

            await expect(uploadUseCase.validateDocuments('cv-id', 'project-id'))
                .rejects.toThrow('One or both documents failed to process');
        });
    });

    describe('cleanupFiles', () => {
        it('should cleanup uploaded files', async () => {
            fs.promises.unlink.mockResolvedValue();

            await uploadUseCase.cleanupFiles(mockFiles);

            expect(fs.promises.unlink).toHaveBeenCalledWith('/uploads/cv_123.pdf');
            expect(fs.promises.unlink).toHaveBeenCalledWith('/uploads/project_456.pdf');
        });

        it('should handle cleanup errors gracefully', async () => {
            fs.promises.unlink.mockRejectedValue(new Error('File not found'));

            await expect(uploadUseCase.cleanupFiles(mockFiles)).resolves.not.toThrow();
        });
    });
});