# Dataset AI LLM

Dataset AI LLM is a full-stack AI data workspace for uploading tabular datasets, profiling them, cleaning quality issues, asking natural-language questions, training simple ML models, generating predictions, and exporting reports.

The project includes a FastAPI backend, a React/Vite frontend, PostgreSQL storage, Pandas-based data processing, scikit-learn analytics, and optional Gemini-powered explanations.

## Features

- Upload CSV and Excel datasets.
- Preview dataset rows and inspect column-level profiles.
- Generate dataset summaries with Gemini.
- Ask natural-language questions about uploaded datasets.
- Execute safe Pandas-based analytical calculations.
- Generate chart-ready responses for visual analysis.
- Scan datasets for quality issues such as missing values, duplicates, outliers, whitespace, invalid emails, and invalid phone values.
- Apply modular cleaning pipelines and save cleaned dataset versions.
- Export cleaned data as CSV, Excel, or JSON.
- Generate PDF cleaning reports.
- Track dataset version history and restore previous versions.
- Run AutoML recommendations, train models, and generate predictions.
- Generate business intelligence reports and export them as PDF, Markdown, or HTML.
- View activity logs, notifications, dashboard metrics, reports, and downloads.

## Tech Stack

**Backend**

- FastAPI
- SQLAlchemy
- PostgreSQL
- Pandas
- scikit-learn
- ReportLab
- Google Generative AI / Gemini

**Frontend**

- React
- Vite
- React Router
- Axios
- Framer Motion
- React Icons
- Tailwind CSS

**Infrastructure**

- Docker Compose
- PostgreSQL 15
- Nginx for frontend production serving

## Project Structure

```text
.
+-- backend/
|   +-- app/
|   |   +-- database/        # SQLAlchemy database setup and DB provisioning
|   |   +-- models/          # Database models
|   |   +-- prompts/         # Gemini prompt templates
|   |   +-- routers/         # FastAPI route modules
|   |   +-- schemas/         # Pydantic schemas
|   |   +-- services/        # Profiling, AI, cleaning, analytics, reports
|   +-- Dockerfile
|   +-- requirements.txt
|   +-- .env.example
+-- frontend/
|   +-- src/
|   |   +-- components/
|   |   +-- layouts/
|   |   +-- pages/
|   |   +-- services/
|   +-- Dockerfile
|   +-- package.json
|   +-- vite.config.js
+-- docker-compose.yml
+-- test_e2e_api.py
+-- test_e2e_ai.py
+-- test_backend_imports.py
+-- README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 15+ or Docker
- Gemini API key for AI features

The backend can start without Gemini, but AI summaries, recommendations, and report explanations will use fallback responses when Gemini is unavailable.

## Environment Variables

Create `backend/.env` from the example file:

```bash
cp backend/.env.example backend/.env
```

Example:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ai_dataset_explorer
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=50
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=
```

For frontend development, you can optionally set:

```env
VITE_API_URL=http://localhost:8000
```

## Run With Docker

From the repository root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

The Docker setup uses:

- Database name: `datasets_db`
- Database user: `postgres`
- Database password: `password123`

Pass `GEMINI_API_KEY` through your shell environment before starting Docker if you want Gemini-backed features:

```bash
set GEMINI_API_KEY=your_gemini_api_key
docker compose up --build
```

On macOS/Linux:

```bash
export GEMINI_API_KEY=your_gemini_api_key
docker compose up --build
```

## Run Locally

### 1. Start PostgreSQL

Create a PostgreSQL database that matches `DATABASE_URL`, or let the backend attempt to create it automatically when it can connect to the default `postgres` database.

### 2. Start Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On macOS/Linux, activate the virtual environment with:

```bash
source .venv/bin/activate
```

Backend URLs:

- API root: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

### 3. Start Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Main API Endpoints

### Datasets

- `POST /api/datasets/upload` - upload a CSV or Excel file.
- `GET /api/datasets` - list uploaded datasets.
- `GET /api/datasets/{id}` - get dataset metadata.
- `GET /api/datasets/{id}/profile` - get dataset profiling results.
- `GET /api/datasets/{id}/preview` - preview the first rows.
- `DELETE /api/datasets/{id}` - delete a dataset and its stored file.

### AI Analyst

- `POST /api/datasets/{id}/summary` - generate or fetch an AI dataset summary.
- `POST /api/datasets/{id}/chat` - ask questions about a dataset.
- `POST /api/datasets/{id}/visualize` - request chart-focused analysis.
- `GET /api/datasets/{id}/chat/history` - get chat history.
- `DELETE /api/datasets/{id}/chat/history` - clear chat history.

### Cleaning

- `POST /api/quality-report` - scan dataset quality.
- `POST /api/clean` - request AI cleaning recommendations.
- `POST /api/datasets/{dataset_id}/apply-cleaning` - apply selected cleaning operations.
- `GET /api/cleaning/history/{dataset_id}` - list cleaning sessions.
- `GET /api/datasets/download/{format}/{dataset_id}` - download data as `csv`, `excel`, or `json`.
- `GET /api/datasets/download/report/{dataset_id}` - download latest cleaning PDF report.

### Analytics

- `GET /api/dashboard` - dashboard metrics.
- `GET /api/activity` - activity logs.
- `GET /api/notifications` - notifications.
- `POST /api/notifications/read` - mark notifications read.
- `GET /api/versions/{dataset_id}` - dataset versions.
- `POST /api/restore-version` - restore a dataset version.
- `GET /api/datasets/{id}/automl-recommend` - get AutoML recommendation.
- `POST /api/train-model` - train a model.
- `POST /api/predict` - generate predictions.
- `POST /api/generate-report` - generate a BI report.
- `GET /api/reports` - list reports.
- `GET /api/reports/{id}` - get report details.
- `GET /api/reports/download/{format_type}/{id}` - download report as `pdf`, `markdown`, or `html`.

## Testing

Install backend dependencies first:

```bash
cd backend
pip install -r requirements.txt
```

Run the root-level checks from the repository root:

```bash
python test_backend_imports.py
pytest test_e2e_api.py
pytest test_e2e_ai.py
```

Run backend E2E scripts:

```bash
cd backend
python test_cleaning_e2e.py
python test_analytics_e2e.py
```

Run frontend checks:

```bash
cd frontend
npm run build
npm run lint
```

## Notes

- Uploaded datasets are stored in the configured `UPLOAD_DIR`.
- The application creates SQLAlchemy tables automatically on backend startup.
- The backend allows local frontend origins on ports `5173` and `3000`.
- Test files use SQLite overrides and temporary upload folders where possible.
- Do not commit real `.env` files, uploaded datasets, API keys, generated reports, or local database files.

## License

No license file is currently included. Add one before publishing if you want to define reuse terms.
