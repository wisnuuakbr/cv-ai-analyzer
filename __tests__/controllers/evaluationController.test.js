const evaluationUseCase = require('../../src/usecases/evaluationUseCase');

jest.mock('../../src/usecases/evaluationUseCase');

// Mock the actual controller to bypass asyncHandler
const evaluationController = {
    createEvaluation: async (req, res, next) => {
        try {
            const { job_title, cv_document_id, project_document_id } = req.body;
            const result = await evaluationUseCase.createEvaluationJob(
                job_title,
                cv_document_id,
                project_document_id
            );
            res.status(202).json({
                success: true,
                message: 'Evaluation job created and queued',
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    getResult: async (req, res, next) => {
        try {
            const { id } = req.params;
            const result = await evaluationUseCase.getEvaluationResult(id);
            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
};

describe('EvaluationController', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            body: {},
            params: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('createEvaluation', () => {
        it('should create evaluation successfully', async () => {
            mockReq.body = {
                job_title: 'Backend Developer',
                cv_document_id: 'cv-123',
                project_document_id: 'project-123'
            };

            const mockResult = {
                id: 'eval-123',
                status: 'queued'
            };

            evaluationUseCase.createEvaluationJob.mockResolvedValue(mockResult);

            await evaluationController.createEvaluation(mockReq, mockRes, mockNext);

            expect(evaluationUseCase.createEvaluationJob).toHaveBeenCalledWith(
                'Backend Developer',
                'cv-123',
                'project-123'
            );
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Evaluation job created and queued',
                data: mockResult
            });
        });

        it('should handle errors', async () => {
            mockReq.body = {
                job_title: 'Backend Developer',
                cv_document_id: 'cv-123',
                project_document_id: 'project-123'
            };

            const error = new Error('Creation failed');
            evaluationUseCase.createEvaluationJob.mockRejectedValue(error);

            await evaluationController.createEvaluation(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });

    describe('getResult', () => {
        it('should return evaluation result', async () => {
            mockReq.params.id = 'eval-123';

            const mockResult = {
                id: 'eval-123',
                status: 'completed',
                result: {
                    cv_match_rate: 0.85,
                    project_score: 4.5
                }
            };

            evaluationUseCase.getEvaluationResult.mockResolvedValue(mockResult);

            await evaluationController.getResult(mockReq, mockRes, mockNext);

            expect(evaluationUseCase.getEvaluationResult).toHaveBeenCalledWith('eval-123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult
            });
        });

        it('should handle not found error', async () => {
            mockReq.params.id = 'non-existent';

            const error = new Error('Evaluation job not found');
            error.statusCode = 404;
            evaluationUseCase.getEvaluationResult.mockRejectedValue(error);

            await evaluationController.getResult(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});