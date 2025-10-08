const llmService = require('./llmService');
const vectorStoreUseCase = require('../usecases/vectorStoreUseCase');
const logger = require('../utils/logger');

class RAGService {
    // Evaluate CV against job description
    async evaluateCV(cvContent, jobTitle) {
        try {
            logger.info('Starting CV evaluation...');
            logger.info(`Job Title: ${jobTitle}`);

            // Check if vector store is initialized
            const healthCheck = await vectorStoreUseCase.healthCheck();
            logger.info('Vector store health:', healthCheck);

            if (healthCheck.status !== 'healthy') {
                throw new Error('Vector store is not healthy');
            }

            // Retrieve relevant job description context
            logger.info('Searching job description context...');
            const jobDescContext = await vectorStoreUseCase.searchContext(
                `${jobTitle} requirements skills experience`,
                'job_description',
                null,
                3
            );
            logger.info(`Job description context found: ${jobDescContext.length} results`);

            if (jobDescContext.length === 0) {
                logger.warn('No job description context found! Vector store might be empty.');
            }

            // Retrieve CV scoring rubric using helper method
            logger.info('Searching CV scoring rubric context...');
            const cvRubricContext = await vectorStoreUseCase.searchCVScoringContext(
                'CV evaluation criteria technical skills experience achievements',
                3
            );
            logger.info(`CV rubric context found: ${cvRubricContext.length} results`);

            if (cvRubricContext.length === 0) {
                logger.warn('No CV rubric context found! Vector store might be missing scoring_rubric data.');
            }

            // Check if we have enough context to proceed
            const totalContextItems = jobDescContext.length + cvRubricContext.length;

            if (totalContextItems === 0) {
                logger.error('CRITICAL: No context found from vector store!');
                logger.error('This means either:');
                logger.error('1. Documents were not ingested properly');
                logger.error('2. Vector store is empty');
                logger.error('3. Search is not working');
                logger.error('Falling back to basic evaluation...');

                return this.getFallbackCVScores(cvContent);
            }

            // Build context from retrieved documents
            const context = this.buildContext([
                { title: 'Job Requirements', results: jobDescContext },
                { title: 'CV Scoring Rubric', results: cvRubricContext }
            ]);

            logger.info(`Built context length: ${context.length} characters`);

            if (context.length < 100) {
                logger.warn('Context too short, might not be useful for evaluation');
            }

            // Build CV summary
            const cvSummary = this.buildCVSummary(cvContent);
            logger.info(`CV summary length: ${cvSummary.length} characters`);

            // Generate evaluation prompt
            const prompt = this.buildCVEvaluationPrompt(context, cvSummary, jobTitle);
            logger.info(`Prompt length: ${prompt.length} characters`);

            // Get LLM evaluation
            logger.info('Generating LLM evaluation...');
            const evaluation = await llmService.generateTextWithRetry(prompt, {
                maxTokens: 500,
                temperature: 0.3
            });

            logger.info('LLM evaluation received');
            logger.debug('LLM response preview:', evaluation.substring(0, 200));

            // Parse evaluation result
            const result = this.parseCVEvaluation(evaluation, cvContent);

            // Add metadata
            result.rag_status = 'success';
            result.context_items_used = totalContextItems;

            logger.info('CV evaluation completed successfully');
            return result;

        } catch (error) {
            logger.error('Error in CV evaluation:', error);
            logger.error('Error stack:', error.stack);

            // Return fallback with error info
            const fallback = this.getFallbackCVScores(cvContent);
            fallback.rag_status = 'failed';
            fallback.rag_error = error.message;

            return fallback;
        }
    }

    // Evaluate project report against case study brief
    async evaluateProject(projectContent) {
        try {
            logger.info('Starting project evaluation...');

            // Check if vector store is initialized
            const healthCheck = await vectorStoreUseCase.healthCheck();
            logger.info('Vector store health:', healthCheck);

            if (healthCheck.status !== 'healthy') {
                throw new Error('Vector store is not healthy');
            }

            // Retrieve case study brief context
            logger.info('Searching case study brief context...');
            const caseStudyContext = await vectorStoreUseCase.searchContext(
                'case study requirements implementation deliverables',
                'case_study_brief',
                null,
                3
            );
            logger.info(`Case study context found: ${caseStudyContext.length} results`);

            if (caseStudyContext.length === 0) {
                logger.warn('No case study context found!');
            }

            // Retrieve project scoring rubric using helper method
            logger.info('Searching project scoring rubric context...');
            const projectRubricContext = await vectorStoreUseCase.searchProjectScoringContext(
                'project evaluation criteria code quality correctness resilience documentation',
                3
            );
            logger.info(`Project rubric context found: ${projectRubricContext.length} results`);

            if (projectRubricContext.length === 0) {
                logger.warn('No project rubric context found!');
            }

            // Check if we have enough context to proceed
            const totalContextItems = caseStudyContext.length + projectRubricContext.length;

            if (totalContextItems === 0) {
                logger.error('CRITICAL: No context found from vector store!');
                logger.error('Falling back to basic evaluation...');

                return this.getFallbackProjectScores(projectContent);
            }

            // Build context
            const context = this.buildContext([
                { title: 'Case Study Requirements', results: caseStudyContext },
                { title: 'Project Scoring Rubric', results: projectRubricContext }
            ]);

            logger.info(`Built context length: ${context.length} characters`);

            if (context.length < 100) {
                logger.warn('Context too short, might not be useful for evaluation');
            }

            // Build project summary
            const projectSummary = this.buildProjectSummary(projectContent);
            logger.info(`Project summary length: ${projectSummary.length} characters`);

            // Generate evaluation prompt
            const prompt = this.buildProjectEvaluationPrompt(context, projectSummary);
            logger.info(`Prompt length: ${prompt.length} characters`);

            // Get LLM evaluation
            logger.info('Generating LLM evaluation...');
            const evaluation = await llmService.generateTextWithRetry(prompt, {
                maxTokens: 500,
                temperature: 0.3
            });

            logger.info('LLM evaluation received');
            logger.debug('LLM response preview:', evaluation.substring(0, 200));

            // Parse evaluation result
            const result = this.parseProjectEvaluation(evaluation, projectContent);

            // Add metadata
            result.rag_status = 'success';
            result.context_items_used = totalContextItems;

            logger.info('Project evaluation completed successfully');
            return result;

        } catch (error) {
            logger.error('Error in project evaluation:', error);
            logger.error('Error stack:', error.stack);

            // Return fallback with error info
            const fallback = this.getFallbackProjectScores(projectContent);
            fallback.rag_status = 'failed';
            fallback.rag_error = error.message;

            return fallback;
        }
    }

    // Generate overall summary
    async generateOverallSummary(cvResult, projectResult, jobTitle) {
        try {
            logger.info('Generating overall summary...');

            // Check RAG status
            const cvRagSuccess = cvResult.rag_status === 'success';
            const projectRagSuccess = projectResult.rag_status === 'success';

            logger.info(`CV RAG status: ${cvResult.rag_status}`);
            logger.info(`Project RAG status: ${projectResult.rag_status}`);

            const prompt = `As an expert recruiter, provide a concise overall evaluation summary (3-5 sentences) for a ${jobTitle} candidate.

            CV Evaluation:
            - Match Rate: ${(cvResult.cv_match_rate * 100).toFixed(0)}%
            - Technical Skills: ${cvResult.cv_technical_skills_score}/5
            - Experience: ${cvResult.cv_experience_score}/5

            Project Evaluation:
            - Overall Score: ${projectResult.project_score}/5
            - Code Quality: ${projectResult.project_code_quality_score}/5
            - Correctness: ${projectResult.project_correctness_score}/5

            ${!cvRagSuccess || !projectRagSuccess ? 'Note: Some evaluations used fallback scoring due to RAG issues.' : ''}

            Provide:
            1. Overall assessment (strong/good/moderate/weak candidate)
            2. Key strengths
            3. Areas for improvement
            4. Recommendation (hire/interview/reject)

            Summary:`;

            const summary = await llmService.generateTextWithRetry(prompt, {
                maxTokens: 300,
                temperature: 0.5
            });

            logger.info('Overall summary generated');
            return summary.trim();

        } catch (error) {
            logger.error('Error generating overall summary:', error);

            // Generate fallback summary
            const cvRate = (cvResult.cv_match_rate * 100).toFixed(0);
            const projectScore = projectResult.project_score;

            let assessment = 'moderate';
            if (cvResult.cv_match_rate >= 0.8 && projectScore >= 4.0) {
                assessment = 'strong';
            } else if (cvResult.cv_match_rate >= 0.7 && projectScore >= 3.5) {
                assessment = 'good';
            } else if (cvResult.cv_match_rate < 0.5 || projectScore < 3.0) {
                assessment = 'weak';
            }

            return `Fallback evaluation completed. CV match rate: ${cvRate}%, Project score: ${projectScore}/5. ` +
                `Overall assessment: ${assessment} candidate. Manual review recommended due to automated evaluation limitations.`;
        }
    }

    // Build context from search results
    buildContext(sections) {
        let context = '';

        sections.forEach(section => {
            if (section.results && section.results.length > 0) {
                context += `\n--- ${section.title} ---\n`;
                section.results.forEach((result, idx) => {
                    context += `\n[${idx + 1}] ${result.text}\n`;
                });
            }
        });

        return context.trim();
    }

    // Build CV summary for evaluation
    buildCVSummary(cvContent) {
        const data = cvContent.extracted_data || {};

        return `
            CV Statistics:
            - Pages: ${cvContent.page_count || 'N/A'}
            - Word Count: ${cvContent.word_count || 'N/A'}
            - Sections: ${data.sections?.join(', ') || 'N/A'}
            - Email: ${data.email || 'Not found'}
            - Phone: ${data.phone || 'Not found'}
            - Skills Found: ${data.skills?.join(', ') || 'None extracted'}

            CV Content Preview:
            ${cvContent.cleaned_text ? cvContent.cleaned_text.substring(0, 2000) : 'No content'}
        `.trim();
    }

    // Build project summary for evaluation
    buildProjectSummary(projectContent) {
        const data = projectContent.extracted_data || {};

        return `
            Project Report Statistics:
            - Pages: ${projectContent.page_count || 'N/A'}
            - Word Count: ${projectContent.word_count || 'N/A'}
            - Sections: ${data.sections?.join(', ') || 'N/A'}
            - Technologies: ${data.technologies?.join(', ') || 'None found'}
            - Code Blocks: ${data.codeBlocks || 0}

            Project Content Preview:
            ${projectContent.cleaned_text ? projectContent.cleaned_text.substring(0, 2000) : 'No content'}
        `.trim();
    }

    // Build CV evaluation prompt
    buildCVEvaluationPrompt(context, cvSummary, jobTitle) {
        return `You are an expert technical recruiter evaluating a CV for a ${jobTitle} position.

        ${context}

        Candidate CV:
        ${cvSummary}

        Evaluate the candidate's CV based on the job requirements and scoring rubric provided above.

        Provide scores (1-5) for each criterion:
        1. Technical Skills Match (40% weight): How well do the candidate's technical skills match the job requirements?
        2. Experience Level (25% weight): Years of experience and project complexity
        3. Relevant Achievements (20% weight): Impact and measurable outcomes
        4. Cultural/Collaboration Fit (15% weight): Communication, teamwork, learning mindset

        For each criterion, provide:
        - Score (1-5)
        - Brief justification (1-2 sentences)

        Format your response EXACTLY as follows:
        Technical Skills: [score]/5 - [justification]
        Experience: [score]/5 - [justification]
        Achievements: [score]/5 - [justification]
        Cultural Fit: [score]/5 - [justification]
        Overall Feedback: [2-3 sentences summarizing the CV evaluation]`;
    }

    // Build project evaluation prompt
    buildProjectEvaluationPrompt(context, projectSummary) {
        return `You are an expert technical evaluator assessing a project report for a backend development case study.

        ${context}

        Project Report:
        ${projectSummary}

        Evaluate the project based on the case study requirements and scoring rubric provided above.

        Provide scores (1-5) for each criterion:
        1. Correctness (30% weight): Meets requirements, implements required features
        2. Code Quality (25% weight): Clean, modular, well-structured, tested
        3. Resilience (20% weight): Error handling, retries, handles failures
        4. Documentation (15% weight): Clear README, explanations, setup instructions
        5. Creativity (10% weight): Extra features, innovative solutions

        For each criterion, provide:
        - Score (1-5)
        - Brief justification (1-2 sentences)

        Format your response EXACTLY as follows:
        Correctness: [score]/5 - [justification]
        Code Quality: [score]/5 - [justification]
        Resilience: [score]/5 - [justification]
        Documentation: [score]/5 - [justification]
        Creativity: [score]/5 - [justification]
        Overall Feedback: [2-3 sentences summarizing the project evaluation]`;
    }

    // Parse CV evaluation from LLM response
    parseCVEvaluation(evaluation, cvContent) {
        try {
            // Extract scores using patterns
            const technicalMatch = evaluation.match(/Technical Skills:\s*(\d+(?:\.\d+)?)/i);
            const experienceMatch = evaluation.match(/Experience:\s*(\d+(?:\.\d+)?)/i);
            const achievementsMatch = evaluation.match(/Achievements:\s*(\d+(?:\.\d+)?)/i);
            const culturalMatch = evaluation.match(/Cultural Fit:\s*(\d+(?:\.\d+)?)/i);

            // Extract feedback
            const feedbackMatch = evaluation.match(/Overall Feedback:\s*(.+?)(?:\n\n|$)/is);

            // Calculate scores (fallback to extracted data if parsing fails)
            const technicalScore = technicalMatch ? parseFloat(technicalMatch[1]) : this.estimateTechnicalScore(cvContent);
            const experienceScore = experienceMatch ? parseFloat(experienceMatch[1]) : 3.5;
            const achievementsScore = achievementsMatch ? parseFloat(achievementsMatch[1]) : 3.0;
            const culturalScore = culturalMatch ? parseFloat(culturalMatch[1]) : 3.5;

            // Calculate weighted average for match rate
            const matchRate = (
                technicalScore * 0.40 +
                experienceScore * 0.25 +
                achievementsScore * 0.20 +
                culturalScore * 0.15
            ) / 5; // Convert to 0-1 scale

            return {
                cv_match_rate: Math.min(0.99, Math.max(0.1, matchRate)),
                cv_feedback: feedbackMatch ? feedbackMatch[1].trim() : evaluation.substring(0, 500),
                cv_technical_skills_score: this.clampScore(technicalScore),
                cv_experience_score: this.clampScore(experienceScore),
                cv_achievements_score: this.clampScore(achievementsScore),
                cv_cultural_fit_score: this.clampScore(culturalScore),
            };

        } catch (error) {
            logger.error('Error parsing CV evaluation:', error);
            // Return fallback scores
            return this.getFallbackCVScores(cvContent);
        }
    }

    // Parse project evaluation from LLM response
    parseProjectEvaluation(evaluation, projectContent) {
        try {
            // Extract scores
            const correctnessMatch = evaluation.match(/Correctness:\s*(\d+(?:\.\d+)?)/i);
            const qualityMatch = evaluation.match(/Code Quality:\s*(\d+(?:\.\d+)?)/i);
            const resilienceMatch = evaluation.match(/Resilience:\s*(\d+(?:\.\d+)?)/i);
            const documentationMatch = evaluation.match(/Documentation:\s*(\d+(?:\.\d+)?)/i);
            const creativityMatch = evaluation.match(/Creativity:\s*(\d+(?:\.\d+)?)/i);

            // Extract feedback
            const feedbackMatch = evaluation.match(/Overall Feedback:\s*(.+?)(?:\n\n|$)/is);

            // Calculate scores
            const correctnessScore = correctnessMatch ? parseFloat(correctnessMatch[1]) : 4.0;
            const qualityScore = qualityMatch ? parseFloat(qualityMatch[1]) : this.estimateCodeQuality(projectContent);
            const resilienceScore = resilienceMatch ? parseFloat(resilienceMatch[1]) : 3.5;
            const documentationScore = documentationMatch ? parseFloat(documentationMatch[1]) : 4.0;
            const creativityScore = creativityMatch ? parseFloat(creativityMatch[1]) : 3.0;

            // Calculate weighted average
            const overallScore = (
                correctnessScore * 0.30 +
                qualityScore * 0.25 +
                resilienceScore * 0.20 +
                documentationScore * 0.15 +
                creativityScore * 0.10
            );

            return {
                project_score: this.clampScore(overallScore),
                project_feedback: feedbackMatch ? feedbackMatch[1].trim() : evaluation.substring(0, 500),
                project_correctness_score: this.clampScore(correctnessScore),
                project_code_quality_score: this.clampScore(qualityScore),
                project_resilience_score: this.clampScore(resilienceScore),
                project_documentation_score: this.clampScore(documentationScore),
                project_creativity_score: this.clampScore(creativityScore),
            };

        } catch (error) {
            logger.error('Error parsing project evaluation:', error);
            return this.getFallbackProjectScores(projectContent);
        }
    }

    // Clamp score between 1 and 5
    clampScore(score) {
        return Math.min(5.0, Math.max(1.0, parseFloat(score) || 3.0));
    }

    // Estimate technical score from CV content
    estimateTechnicalScore(cvContent) {
        const skills = cvContent.extracted_data?.skills || [];
        if (skills.length >= 8) return 4.5;
        if (skills.length >= 5) return 4.0;
        if (skills.length >= 3) return 3.5;
        return 3.0;
    }

    // Estimate code quality from project content
    estimateCodeQuality(projectContent) {
        const codeBlocks = projectContent.extracted_data?.codeBlocks || 0;
        const wordCount = projectContent.word_count || 0;

        if (codeBlocks > 5 && wordCount > 2000) return 4.5;
        if (codeBlocks > 3 && wordCount > 1500) return 4.0;
        if (codeBlocks > 0 && wordCount > 1000) return 3.5;
        return 3.0;
    }

    // Fallback CV scores
    getFallbackCVScores(cvContent) {
        const skills = cvContent.extracted_data?.skills || [];
        const technicalScore = this.estimateTechnicalScore(cvContent);

        return {
            cv_match_rate: 0.70,
            cv_feedback: `CV contains ${skills.length} identified technical skills. Fallback evaluation used due to RAG failure.`,
            cv_technical_skills_score: technicalScore,
            cv_experience_score: 3.5,
            cv_achievements_score: 3.0,
            cv_cultural_fit_score: 3.5,
        };
    }

    // Fallback project scores
    getFallbackProjectScores(projectContent) {
        const qualityScore = this.estimateCodeQuality(projectContent);
        const wordCount = projectContent.word_count || 0;
        const codeBlocks = projectContent.extracted_data?.codeBlocks || 0;

        return {
            project_score: Math.max(3.5, qualityScore),
            project_feedback: `Project report contains ${codeBlocks} code blocks and ${wordCount} words. Fallback evaluation used.`,
            project_correctness_score: 3.5,
            project_code_quality_score: qualityScore,
            project_resilience_score: 3.0,
            project_documentation_score: wordCount > 1000 ? 3.5 : 2.5,
            project_creativity_score: 3.0,
        };
    }
}

module.exports = new RAGService();