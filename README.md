# CV AI Analyzer

AI-powered CV and Project Report Evaluation System using RAG (Retrieval-Augmented Generation).

## Overview

Automatically evaluates job candidates by analyzing CVs and project reports using LLM and vector similarity search. The system scores candidates on technical skills, experience, code quality, and provides detailed feedback.

**Key Features:**

-   PDF document upload and text extraction
-   RAG-based evaluation with vector database (Qdrant)
-   Async job processing with BullMQ
-   Structured scoring with detailed feedback
-   Fallback rule-based evaluation

---

## Tech Stack

-   **Backend**: Node.js 18+, Express.js
-   **Database**: MySQL 8.0, Redis 7, Qdrant (vector DB)
-   **AI/ML**: HuggingFace API (Mistral-7B, BAAI/bge-small-en-v1.5)
-   **Queue**: BullMQ
-   **DevOps**: Docker

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────────────────────────────────┐
│         Express.js API Server           │
│  ┌─────────────────────────────────┐    │
│  │  Controllers (HTTP Interface)   │    │
│  └──────────┬──────────────────────┘    │
│             │                           │
│  ┌──────────▼──────────────────────┐    │
│  │  Use Cases (Business Logic)     │    │
│  └──────────┬──────────────────────┘    │
│             │                           │
│  ┌──────────▼──────────────────────┐    │
│  │  Repositories (Data Access)     │    │
│  └──────────┬──────────────────────┘    │
└─────────────┼───────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
┌────────┐ ┌──────┐ ┌────────┐
│ MySQL  │ │Redis │ │Qdrant  │
│   DB   │ │Queue │ │Vector  │
└────────┘ └──┬───┘ └────────┘
              │
              ▼
      ┌──────────────┐
      │   Worker     │
      │  (BullMQ)    │
      │              │
      │              │
      │              │
      └──────────────┘
```

**Data Flow:**

1. Upload CV + Project (PDF) → Auto-extract text
2. Create evaluation → Queue job
3. Worker processes → RAG evaluation → Save results
4. Poll result endpoint → Get scores + feedback

---

## Quick Start

### Prerequisites

-   Docker & Docker Compose
-   HuggingFace API key ([Get here](https://huggingface.co/settings/tokens))

### Installation

```bash
# 1. Clone and setup
git clone https://github.com/wisnuuakbr/cv-ai-analyzer.git
cd cv-ai-analyzer
cp .env.example .env

# 2. Edit .env - ADD YOUR HUGGINGFACE_API_KEY
nano .env

# 3. Create directories
mkdir -p uploads docs logs

# 4. Start services
docker-compose up -d --build

# 5. Run migrations
docker-compose exec app npm run db:migrate

# 6. Copy reference PDFs to docs/ folder then ingest
docker-compose exec app npm run ingest

# 7. Test
curl http://localhost:3000/api/health
```

**Required Reference Documents** (place in `docs/`):

-   `job_description.pdf` - Job requirements and qualifications
-   `case_study_brief.pdf` - Project case study requirements
-   `scoring_rubric.pdf` - Combined rubric with CV and Project sections

**⚠️ Important**: Reference documents **must be ingested** before evaluations will work properly. Without ingestion, the system will use fallback evaluation mode (lower quality, generic feedback).

---

## API Endpoints

### 1. Upload Documents

```bash
POST /api/upload
Content-Type: multipart/form-data

curl -X POST http://localhost:3000/api/upload \
  -F "cv=@cv.pdf" \
  -F "project_report=@project.pdf"

# Response:
{
  "success": true,
  "data": {
    "cv": { "id": "uuid-1", "filename": "cv.pdf" },
    "project_report": { "id": "uuid-2", "filename": "project.pdf" }
  }
}
```

### 2. Create Evaluation

```bash
POST /api/evaluate
Content-Type: application/json

curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Backend Developer",
    "cv_document_id": "uuid-1",
    "project_document_id": "uuid-2"
  }'

# Response (202 Accepted):
{
  "success": true,
  "data": {
    "id": "eval-uuid",
    "status": "queued"
  }
}
```

### 3. Get Result

```bash
GET /api/result/:id

curl http://localhost:3000/api/result/eval-uuid

# Response (completed):
{
  "success": true,
  "data": {
    "id": "eval-uuid",
    "status": "completed",
    "result": {
      "cv_match_rate": 0.85,
      "cv_feedback": "Strong technical background...",
      "project_score": 4.5,
      "project_feedback": "Excellent code quality...",
      "overall_summary": "Highly recommended candidate..."
    }
  }
}
```

**Status values**: `queued`, `processing`, `completed`, `failed`

---

## Configuration

### Environment Variables (.env)

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DB_HOST=db        # Use 'db' for Docker
DB_PORT=3306
DB_NAME=cv_ai_analyzer
DB_USER=cv_user
DB_PASSWORD=your_password

# Redis
REDIS_HOST=redis     # Use 'redis' for Docker
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# HuggingFace (REQUIRED)
HUGGINGFACE_API_KEY=hf_your_key_here
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000

# Qdrant
QDRANT_HOST=qdrant    # Use 'qdrant' for Docker
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=evaluation_docs
QDRANT_API_KEY=          # Optional for local

# Upload
MAX_FILE_SIZE=10485760   # 10MB
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Project Structure

```
cv-ai-analyzer/
├── docs/                           # Reference documents for RAG
│   ├── job_description.pdf
│   ├── case_study_brief.pdf
│   └── cv_scoring_rubric.pdf
├── logs/                           # Application logs
├── scripts/                        # Admin scripts
│   └── ingestDocuments.js         # Ingest reference docs to Qdrant
├── src/
│   ├── config/                    # Configuration
│   │   ├── index.js              # Main config
│   │   └── db.js                 # Database connection
│   ├── controllers/               # HTTP layer
│   │   ├── uploadController.js
│   │   └── evaluationController.js
│   ├── middlewares/               # Express middlewares
│   │   ├── errorHandler.js
│   │   ├── upload.js
│   │   └── validation.js
│   ├── migrations/                # Database migrations
│   ├── models/                    # Sequelize models
│   │   ├── document.js
│   │   ├── content.js
│   │   ├── evaluationJob.js
│   │   ├── evaluationResult.js
│   │   └── index.js
│   ├── repositories/              # Data access layer
│   │   ├── documentRepository.js
│   │   ├── contentRepository.js
│   │   ├── evaluationJobRepository.js
│   │   └── evaluationResultRepository.js
│   ├── routes/                    # API routes
│   │   ├── index.js
│   │   ├── uploadRoutes.js
│   │   ├── evaluationRoutes.js
│   │   └── resultRoutes.js
│   ├── services/                  # External services
│   │   ├── embeddingService.js   # HuggingFace embeddings
│   │   ├── llmService.js         # HuggingFace LLM
│   │   └── ragService.js
│   ├── usecases/                  # Business logic
│   │   ├── uploadUseCase.js
│   │   ├── documentExtractionUseCase.js
│   │   ├── evaluationUseCase.js
│   │   └── vectorStoreUseCase.js
│   ├── utils/                     # Utilities
│   │   ├── logger.js
│   │   ├── pdfParser.js
│   │   ├── queueManager.js
│   │   └── qdrantClient.js
│   ├── workers/                   # Background workers
│   │   └── evaluationWorker.js
│   ├── app.js                     # Express app
│   └── index.js                   # Entry point
├── uploads/                        # Uploaded files
├── __tests__/                      # Unit tests
├── .env.example                    # Environment template
├── .gitignore
├── docker-compose.yml              # Docker orchestration
├── Dockerfile
├── jest.config.js                  # Test configuration
├── package.json
└── README.md
```

---

## Trade-offs Summary

| Decision     | Chosen             | Alternative          | Reason                    |
| ------------ | ------------------ | -------------------- | ------------------------- |
| Queue System | BullMQ             | Simple in-memory     | Need persistence, retries |
| LLM Model    | Mistral-7B (API)   | GPT-4 / Local Ollama | Cost vs quality balance   |
| Vector DB    | Qdrant             | Pinecone             | Open-source, self-hosted  |
| Extraction   | Async (background) | Sync (blocking)      | Better UX vs complexity   |
| Testing      | Unit tests only    | + Integration tests  | Speed vs coverage         |

---

## Evaluation Criteria

### CV Scoring (0-1 match rate)

-   Technical Skills (40% weight)
-   Experience (25%)
-   Achievements (20%)
-   Cultural Fit (15%)

### Project Scoring (1-5 scale)

-   Correctness (30% weight)
-   Code Quality (25%)
-   Resilience (20%)
-   Documentation (15%)
-   Creativity (10%)

---

### Debug Mode

```bash
# .env
LOG_LEVEL=debug

# View logs
docker-compose logs -f app
tail -f logs/combined.log
```

---

## Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Restart specific service
docker-compose restart app

# Execute commands
docker-compose exec app npm run db:migrate

# Shell access
docker-compose exec app sh
```

---

## Deployment

### Deploy with Docker Compose

```bash
docker-compose up -d --build
docker-compose exec app npm run db:migrate
docker-compose exec app npm run ingest
```

---
