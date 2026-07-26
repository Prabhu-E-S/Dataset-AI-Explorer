import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from app.config import settings
from app.database.db_utils import create_db_if_not_exists
from app.database.database import engine, Base
# Import models to ensure their database schema metadata registration before table auto-creation
from app.models.dataset import Dataset
from app.models.chat import ChatSession, ChatMessage
from app.models.cleaning import CleaningSession, CleaningOperation, CleaningReport, DownloadHistory
from app.models.analytics import DatasetVersion, MLModel, Prediction, AnalyticsReport, ActivityLog, Notification
from app.routers import datasets, cleaning, analytics

# 1. Database Provisioning & Table Initialization
create_db_if_not_exists()
Base.metadata.create_all(bind=engine)

# 2. FastAPI Initialization
app = FastAPI(
    title="AI Dataset Explorer API",
    description="Backend API for exploring, previewing, and profiling tabular datasets",
    version="1.0.0"
)

# 3. CORS Middleware Configuration
# Allows requests from standard Vite port (5173), fallback ports, and generic dev endpoints
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Include Endpoints Routers
app.include_router(datasets.router)
app.include_router(cleaning.router)
app.include_router(analytics.router)

# 5. Global Error Handlers for Premium API Experience
@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    """Fallback handler to prevent raw server failures from leaking or crashing"""
    print(f"Unhandled Exception: {str(exc)}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"An unexpected system error occurred: {str(exc)}"}
    )

@app.get("/")
def read_root():
    return {"message": "AI Dataset Explorer API is operational. Access docs at /docs"}

if __name__ == "__main__":
    uvicorn.run("main.py:app", host="0.0.0.0", port=8000, reload=True)
