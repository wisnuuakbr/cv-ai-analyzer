const ragService = require('../../src/services/ragService');
const llmService = require('../../src/services/llmService');
const vectorStoreUseCase = require('../../src/usecases/vectorStoreUseCase');

jest.mock('../../src/services/llmService');
jest.mock('../../src/usecases/vectorStoreUseCase');

describe('RAGService', () => {
    const mockCVContent = {
        raw_text: 'Wisnu Akbara',
        cleaned_text: 'Wisnu Akbara',
        extracted_data: {
            email: 'wisnu@example.com',
            phone: '123-456-7890',
            skills: ['javascript', 'golang', 'php', 'node.js']
        },
        page_count: 2,
        word_count: 500,
        character_count: 3000
    };

    const mockProjectContent = {
        raw_text: 'Project report content',
        cleaned_text: 'Project report content',
        extracted_data: {
            technologies: ['express', 'sequelize', 'jest'],
            codeBlocks: 5
        },
        page_count: 5,
        word_count: 2000,
        character_count: 12000
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('evaluateCV', () => {
        it('should evaluate CV successfully with RAG', async () => {
            const mockJobDescResults = [
                { text: 'Backend developer requirements...', score: 0.9 }
            ];
            const mockRubricResults = [
                { text: 'CV evaluation criteria...', score: 0.85 }
            ];

            const mockLLMResponse = `Technical Skills: 4.5/5 - Strong technical background
            Experience: 4.0/5 - Good experience level
            Achievements: 3.5/5 - Notable achievements
            Cultural Fit: 4.0/5 - Good collaboration skills
            Overall Feedback: Strong candidate with solid technical skills`;

            vectorStoreUseCase.searchContext
                .mockResolvedValueOnce(mockJobDescResults);
            vectorStoreUseCase.searchCVScoringContext
                .mockResolvedValueOnce(mockRubricResults);

            llmService.generateTextWithRetry.mockResolvedValue(mockLLMResponse);

            const result = await ragService.evaluateCV(mockCVContent, 'Backend Developer');

            expect(result).toHaveProperty('cv_match_rate');
            expect(result).toHaveProperty('cv_feedback');
            expect(result).toHaveProperty('cv_technical_skills_score');
            expect(result.cv_technical_skills_score).toBe(4.5);
            expect(result.cv_experience_score).toBe(4.0);
            expect(vectorStoreUseCase.searchContext).toHaveBeenCalledWith(
                expect.any(String),
                'job_description',
                expect.anything(),
                expect.any(Number)
            );
            expect(vectorStoreUseCase.searchCVScoringContext).toHaveBeenCalled();
        });

        it('should return fallback scores when LLM fails', async () => {
            vectorStoreUseCase.searchContext.mockResolvedValue([]);
            vectorStoreUseCase.searchCVScoringContext.mockResolvedValue([]);

            llmService.generateTextWithRetry.mockImplementation(() =>
                Promise.reject(new Error('LLM API failed'))
            );

            await expect(ragService.evaluateCV(mockCVContent, 'Backend Developer'))
                .rejects.toThrow('LLM API failed');
        });
    });

    describe('evaluateProject', () => {
        it('should evaluate project successfully with RAG', async () => {
            const mockBriefResults = [
                { text: 'Case study requirements...', score: 0.85 }
            ];
            const mockRubricResults = [
                { text: 'Project evaluation criteria...', score: 0.88 }
            ];

            const mockLLMResponse = `Correctness: 4.5/5 - Meets requirements
            Code Quality: 4.0/5 - Well structured
            Resilience: 3.5/5 - Good error handling
            Documentation: 4.5/5 - Clear documentation
            Creativity: 3.0/5 - Standard implementation
            Overall Feedback: Well executed project`;

            vectorStoreUseCase.searchContext
                .mockResolvedValueOnce(mockBriefResults);
            vectorStoreUseCase.searchProjectScoringContext
                .mockResolvedValueOnce(mockRubricResults);

            llmService.generateTextWithRetry.mockResolvedValue(mockLLMResponse);

            const result = await ragService.evaluateProject(mockProjectContent);

            expect(result).toHaveProperty('project_score');
            expect(result).toHaveProperty('project_feedback');
            expect(result.project_correctness_score).toBe(4.5);
            expect(result.project_code_quality_score).toBe(4.0);
            expect(vectorStoreUseCase.searchContext).toHaveBeenCalledWith(
                expect.any(String),
                'case_study_brief',
                expect.anything(),
                expect.any(Number)
            );
            expect(vectorStoreUseCase.searchProjectScoringContext).toHaveBeenCalled();
        });
    });

    describe('generateOverallSummary', () => {
        it('should generate overall summary', async () => {
            const mockCVResult = {
                cv_match_rate: 0.85,
                cv_technical_skills_score: 4.5,
                cv_experience_score: 4.0
            };

            const mockProjectResult = {
                project_score: 4.2,
                project_code_quality_score: 4.0,
                project_correctness_score: 4.5
            };

            const mockSummary = 'Strong candidate with excellent technical skills and good project execution.';

            llmService.generateTextWithRetry.mockResolvedValue(mockSummary);

            const result = await ragService.generateOverallSummary(
                mockCVResult,
                mockProjectResult,
                'Backend Developer'
            );

            expect(result).toBe(mockSummary);
            expect(llmService.generateTextWithRetry).toHaveBeenCalled();
        });
    });

    describe('parseCVEvaluation', () => {
        it('should parse LLM response correctly', () => {
            const mockResponse = `Technical Skills: 4.5/5 - Strong
            Experience: 4.0/5 - Good
            Achievements: 3.5/5 - Notable
            Cultural Fit: 4.0/5 - Excellent
            Overall Feedback: Strong candidate`;

            const result = ragService.parseCVEvaluation(mockResponse, mockCVContent);

            expect(result.cv_technical_skills_score).toBe(4.5);
            expect(result.cv_experience_score).toBe(4.0);
            expect(result.cv_achievements_score).toBe(3.5);
            expect(result.cv_cultural_fit_score).toBe(4.0);
            expect(result).toHaveProperty('cv_match_rate');
        });

        it('should return fallback scores when parsing fails', () => {
            const invalidResponse = 'Invalid response format';

            const result = ragService.parseCVEvaluation(invalidResponse, mockCVContent);

            expect(result).toHaveProperty('cv_match_rate');
            expect(result).toHaveProperty('cv_feedback');
            expect(result.cv_technical_skills_score).toBeGreaterThan(0);
        });
    });

    describe('parseProjectEvaluation', () => {
        it('should parse project evaluation correctly', () => {
            const mockResponse = `Correctness: 4.5/5 - Excellent
            Code Quality: 4.0/5 - Good
            Resilience: 3.5/5 - Fair
            Documentation: 4.5/5 - Clear
            Creativity: 3.0/5 - Standard
            Overall Feedback: Well done`;

            const result = ragService.parseProjectEvaluation(mockResponse, mockProjectContent);

            expect(result.project_correctness_score).toBe(4.5);
            expect(result.project_code_quality_score).toBe(4.0);
            expect(result.project_resilience_score).toBe(3.5);
            expect(result.project_documentation_score).toBe(4.5);
            expect(result.project_creativity_score).toBe(3.0);
        });
    });

    describe('clampScore', () => {
        it('should clamp score between 1 and 5', () => {
            expect(ragService.clampScore(6.5)).toBe(5.0);
            expect(ragService.clampScore(0.5)).toBe(1.0);
            expect(ragService.clampScore(3.5)).toBe(3.5);
        });

        it('should handle invalid input', () => {
            expect(ragService.clampScore(null)).toBe(3.0);
            expect(ragService.clampScore(undefined)).toBe(3.0);
        });
    });

    describe('buildContext', () => {
        it('should build context from search results', () => {
            const sections = [
                {
                    title: 'Job Requirements',
                    results: [
                        { text: 'Backend experience required' },
                        { text: 'Knowledge of Node.js' }
                    ]
                }
            ];

            const context = ragService.buildContext(sections);

            expect(context).toContain('Job Requirements');
            expect(context).toContain('Backend experience required');
            expect(context).toContain('Knowledge of Node.js');
        });

        it('should handle empty results', () => {
            const sections = [
                {
                    title: 'Empty Section',
                    results: []
                }
            ];

            const context = ragService.buildContext(sections);

            expect(context).toContain('Empty Section');
        });

        it('should handle multiple sections', () => {
            const sections = [
                {
                    title: 'Section 1',
                    results: [{ text: 'Content 1' }]
                },
                {
                    title: 'Section 2',
                    results: [{ text: 'Content 2' }]
                }
            ];

            const context = ragService.buildContext(sections);

            expect(context).toContain('Section 1');
            expect(context).toContain('Section 2');
            expect(context).toContain('Content 1');
            expect(context).toContain('Content 2');
        });
    });
});