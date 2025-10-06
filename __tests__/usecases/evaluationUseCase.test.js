const evaluationUseCase = require('../../src/usecases/evaluationUseCase');
const evaluationJobRepository = require('../../src/repositories/evaluationJobRepository');
const uploadUseCase = require('../../src/usecases/uploadUseCase');
const queueManager = require('../../src/utils/queueManager');

jest.mock('../../src/repositories/evaluationJobRepository');
jest.mock('../../src/usecases/uploadUseCase');
jest.mock('../../src/utils/queueManager');

describe('EvaluationUseCase', () => {
    const mockJobData = {
        jobTitle: 'Backend Developer',
        cvDocumentId: 'cv-123',
        projectDocumentId: 'project-123'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createEvaluationJob', () => {
        it('should create evaluation job successfully', async () => {
            const mockJob = {
                id: 'job-123',
                job_title: 'Backend Developer',
                cv_document_id: 'cv-123',
                project_document_id: 'project-123',
                status: 'queued'
            };

            const mockValidation = {
                cvDoc: { id: 'cv-123', file_type: 'cv' },
                projectDoc: { id: 'project-123', file_type: 'project_report' }
            };

            uploadUseCase.validateDocuments.mockResolvedValue(mockValidation);
            evaluationJobRepository.create.mockResolvedValue(mockJob);
            queueManager.addEvaluationJob.mockResolvedValue({ id: 'job-123' });

            const result = await evaluationUseCase.createEvaluationJob(
                mockJobData.jobTitle,
                mockJobData.cvDocumentId,
                mockJobData.projectDocumentId
            );

            expect(result).toEqual({
                id: 'job-123',
                status: 'queued'
            });

            expect(uploadUseCase.validateDocuments).toHaveBeenCalledWith(
                'cv-123',
                'project-123'
            );

            expect(evaluationJobRepository.create).toHaveBeenCalledWith({
                job_title: 'Backend Developer',
                cv_document_id: 'cv-123',
                project_document_id: 'project-123',
                status: 'queued'
            });

            expect(queueManager.addEvaluationJob).toHaveBeenCalledWith({
                jobId: 'job-123',
                jobTitle: 'Backend Developer',
                cvDocumentId: 'cv-123',
                projectDocumentId: 'project-123'
            });
        });

        it('should throw error when document validation fails', async () => {
            uploadUseCase.validateDocuments.mockRejectedValue(new Error('Document not found'));

            await expect(evaluationUseCase.createEvaluationJob(
                mockJobData.jobTitle,
                mockJobData.cvDocumentId,
                mockJobData.projectDocumentId
            )).rejects.toThrow('Document not found');

            expect(evaluationJobRepository.create).not.toHaveBeenCalled();
            expect(queueManager.addEvaluationJob).not.toHaveBeenCalled();
        });
    });

    describe('getEvaluationResult', () => {
        it('should return queued job status', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'queued'
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);
            queueManager.getJob.mockResolvedValue(null);

            const result = await evaluationUseCase.getEvaluationResult('job-123');

            expect(result).toEqual({
                id: 'job-123',
                status: 'queued'
            });
        });

        it('should return completed job with results', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'completed',
                result: {
                    cv_match_rate: '0.85',
                    cv_feedback: 'Strong candidate',
                    project_score: '4.50',
                    project_feedback: 'Excellent project',
                    overall_summary: 'Highly recommended'
                }
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);
            queueManager.getJob.mockResolvedValue(null);

            const result = await evaluationUseCase.getEvaluationResult('job-123');

            expect(result).toEqual({
                id: 'job-123',
                status: 'completed',
                result: {
                    cv_match_rate: 0.85,
                    cv_feedback: 'Strong candidate',
                    project_score: 4.5,
                    project_feedback: 'Excellent project',
                    overall_summary: 'Highly recommended'
                }
            });
        });

        it('should return failed job with error message', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'failed',
                error_message: 'Processing failed',
                retry_count: 2
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);
            queueManager.getJob.mockResolvedValue(null);

            const result = await evaluationUseCase.getEvaluationResult('job-123');

            expect(result).toEqual({
                id: 'job-123',
                status: 'failed',
                error: 'Processing failed',
                retry_count: 2
            });
        });

        it('should throw error when job not found', async () => {
            evaluationJobRepository.findById.mockResolvedValue(null);

            await expect(evaluationUseCase.getEvaluationResult('non-existent'))
                .rejects.toThrow('Evaluation job not found');
        });

        it('should include queue progress when available', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'processing'
            };

            const mockQueueJob = {
                getState: jest.fn().mockResolvedValue('active'),
                progress: 50
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);
            queueManager.getJob.mockResolvedValue(mockQueueJob);

            const result = await evaluationUseCase.getEvaluationResult('job-123');

            expect(result).toEqual({
                id: 'job-123',
                status: 'processing',
                queueState: 'active',
                progress: 50
            });
        });
    });

    describe('retryJob', () => {
        it('should retry failed job successfully', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'failed',
                job_title: 'Backend Developer',
                cv_document_id: 'cv-id',
                project_document_id: 'project-id'
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);
            evaluationJobRepository.updateStatus.mockResolvedValue({});
            queueManager.addEvaluationJob.mockResolvedValue({});

            const result = await evaluationUseCase.retryJob('job-123');

            expect(result).toEqual({
                id: 'job-123',
                status: 'queued',
                message: 'Job has been re-queued for processing'
            });

            expect(evaluationJobRepository.updateStatus).toHaveBeenCalledWith('job-123', 'queued', {
                error_message: null
            });

            expect(queueManager.addEvaluationJob).toHaveBeenCalled();
        });

        it('should throw error when job not found', async () => {
            evaluationJobRepository.findById.mockResolvedValue(null);

            await expect(evaluationUseCase.retryJob('non-existent'))
                .rejects.toThrow('Evaluation job not found');
        });

        it('should throw error when job is not failed', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'completed'
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);

            await expect(evaluationUseCase.retryJob('job-123'))
                .rejects.toThrow('Only failed jobs can be retried');
        });
    });

    describe('cancelJob', () => {
        it('should cancel queued job successfully', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'queued'
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);
            queueManager.removeJob.mockResolvedValue();
            evaluationJobRepository.updateStatus.mockResolvedValue({});

            const result = await evaluationUseCase.cancelJob('job-123');

            expect(result).toEqual({
                id: 'job-123',
                status: 'failed',
                message: 'Job has been cancelled'
            });

            expect(queueManager.removeJob).toHaveBeenCalledWith('job-123');
            expect(evaluationJobRepository.updateStatus).toHaveBeenCalledWith('job-123', 'failed', {
                error_message: 'Job cancelled by user'
            });
        });

        it('should throw error when trying to cancel completed job', async () => {
            const mockJob = {
                id: 'job-123',
                status: 'completed'
            };

            evaluationJobRepository.findById.mockResolvedValue(mockJob);

            await expect(evaluationUseCase.cancelJob('job-123'))
                .rejects.toThrow('Cannot cancel completed job');
        });
    });

    describe('getQueueStats', () => {
        it('should return queue statistics', async () => {
            const mockStats = {
                waiting: 5,
                active: 2,
                completed: 100,
                failed: 3,
                delayed: 0,
                total: 110
            };

            queueManager.getQueueStats.mockResolvedValue(mockStats);

            const result = await evaluationUseCase.getQueueStats();

            expect(result).toEqual(mockStats);
            expect(queueManager.getQueueStats).toHaveBeenCalled();
        });
    });
});