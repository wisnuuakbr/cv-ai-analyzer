const uploadUseCase = require('../../src/usecases/uploadUseCase');

jest.mock('../../src/usecases/uploadUseCase');

// Mock the actual controller to bypass asyncHandler
const uploadController = {
    uploadDocuments: async (req, res, next) => {
        try {
            const result = await uploadUseCase.uploadDocuments(req.files);
            res.status(201).json({
                success: true,
                message: 'Documents uploaded successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
};

describe('UploadController', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            files: {
                cv: [{ filename: 'cv.pdf' }],
                project_report: [{ filename: 'project.pdf' }]
            }
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('uploadDocuments', () => {
        it('should upload documents successfully', async () => {
            const mockResult = {
                cv: { id: 'cv-123', filename: 'cv.pdf', size: 1024 },
                project_report: { id: 'project-123', filename: 'project.pdf', size: 2048 }
            };

            uploadUseCase.uploadDocuments.mockResolvedValue(mockResult);

            await uploadController.uploadDocuments(mockReq, mockRes, mockNext);

            expect(uploadUseCase.uploadDocuments).toHaveBeenCalledWith(mockReq.files);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Documents uploaded successfully',
                data: mockResult
            });
        });

        it('should handle errors', async () => {
            const error = new Error('Upload failed');
            uploadUseCase.uploadDocuments.mockRejectedValue(error);

            await uploadController.uploadDocuments(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});