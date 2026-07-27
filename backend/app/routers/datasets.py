from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.orm import Session
import os
import pandas as pd
import numpy as np
import json

from app.database.database import get_db
from app.models.dataset import Dataset
from app.models.chat import ChatSession, ChatMessage
from app.schemas.dataset import (
    DatasetResponse, 
    DatasetProfileResponse, 
    DatasetPreviewResponse
)
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    DatasetSummaryResponse,
    ChatMessageResponse
)
from app.services.storage import save_uploaded_file, delete_local_file
from app.services.profiler import profile_dataset, json_clean
from app.services.ai.gemini_service import GeminiService
from app.services.pandas_executor import execute_pandas_calculations
from app.services.chart_generator import generate_plotly_spec
from app.config import settings

router = APIRouter(
    prefix="/api/datasets",
    tags=["datasets"]
)

@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a dataset:
    1. Save files to local disk validation sizes and types.
    2. Runs profiling engine with Pandas.
    3. Persists metadata and profile statistics to database.
    """
    # Save the file locally with validations
    unique_filename, original_filename, file_type, file_size = save_uploaded_file(file)
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    try:
        # Run profiling
        profile_data = profile_dataset(file_path, file_type)
    except Exception as e:
        # If profiling fails (corrupted file, parsing error), clean up physical file
        delete_local_file(unique_filename)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Uploaded file is corrupt or invalid: {str(e)}"
        )

    # Save metadata models to db
    db_dataset = Dataset(
        filename=unique_filename,
        original_filename=original_filename,
        file_type=file_type,
        rows=profile_data["dimensions"]["rows"],
        columns=profile_data["dimensions"]["columns"],
        file_size=file_size,
        profile_data=profile_data
    )

    try:
        db.add(db_dataset)
        db.commit()
        db.refresh(db_dataset)

        # Register version 1 and activity
        from app.models.analytics import DatasetVersion, ActivityLog
        initial_version = DatasetVersion(
            dataset_id=db_dataset.id,
            version_number=1,
            name="Original Version",
            filename=unique_filename
        )
        db.add(initial_version)
        
        activity = ActivityLog(
            action_type="dataset_uploaded",
            description=f"Uploaded new dataset: {original_filename} ({db_dataset.rows} rows, {db_dataset.columns} columns)"
        )
        db.add(activity)

        # Notify
        from app.models.analytics import Notification
        notif = Notification(
            title="Dataset Uploaded",
            message=f"Dataset {original_filename} uploaded successfully.",
            type="success"
        )
        db.add(notif)
        
        db.commit()
    except Exception as e:
        delete_local_file(unique_filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record metadata in database: {str(e)}"
        )

    return db_dataset

@router.get("", response_model=list[DatasetResponse])
def list_datasets(db: Session = Depends(get_db)):
    """Retrieve lists of metadata for all uploaded datasets"""
    return db.query(Dataset).order_by(Dataset.upload_time.desc()).all()

@router.get("/{id}", response_model=DatasetResponse)
def get_dataset(id: str, db: Session = Depends(get_db)):
    """Retrieve basic metadata for a single dataset"""
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {id} not found."
        )
    return dataset

@router.get("/{id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(id: str, db: Session = Depends(get_db)):
    """Retrieve full profiling details for a single dataset"""
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {id} not found."
        )
    return dataset

@router.get("/{id}/preview", response_model=DatasetPreviewResponse)
def get_dataset_preview(id: str, db: Session = Depends(get_db)):
    """
    Returns the first 100 rows preview of the dataset.
    The response details columns structure and rows contents.
    """
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {id} not found."
        )

    file_path = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file for this dataset was not found on server disk."
        )

    try:
        # Load max 100 rows to keep it performant
        if dataset.file_type.lower() == "csv":
            df = pd.read_csv(file_path, nrows=100, low_memory=False)
        else:
            df = pd.read_excel(file_path, nrows=100)
            
        columns = list(df.columns)
        
        # Convert NaN values to None for proper rendering/JSON conformity
        # We replace nan with None and convert dataframe to dict records
        df_cleaned = df.replace({np.nan: None})
        records = df_cleaned.to_dict(orient="records")
        # Ensure all columns are present, fill out any missing keys in records
        cleaned_records = []
        for r in records:
            cleaned_row = {}
            for col in columns:
                val = r.get(col)
                # Ensure numpy types are converted as well
                cleaned_row[col] = json_clean(val)
            cleaned_records.append(cleaned_row)

        return DatasetPreviewResponse(
            id=dataset.id,
            filename=dataset.original_filename,
            columns=columns,
            data=cleaned_records,
            total_preview_rows=len(cleaned_records),
            total_dataset_rows=dataset.rows
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file preview: {str(e)}"
        )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(id: str, db: Session = Depends(get_db)):
    """Deletes a dataset: removes database records and physical disk representation"""
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {id} not found."
        )

    # Delete disk file
    delete_local_file(dataset.filename)

    # Delete db record
    db.delete(dataset)
    db.commit()
    return

# --- Phase 2: AI Data Analyst REST API Endpoints ---

def load_dataframe(dataset: Dataset) -> pd.DataFrame:
    """Helper to safely read file into a pandas dataframe"""
    file_path = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file for this dataset was not found on server disk."
        )
    try:
        if dataset.file_type.lower() == "csv":
            return pd.read_csv(file_path, low_memory=False)
        else:
            return pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read dataset file: {str(e)}"
        )

@router.post("/{id}/summary", response_model=DatasetSummaryResponse, status_code=status.HTTP_201_CREATED)
async def generate_dataset_summary(id: str, db: Session = Depends(get_db)):
    """Generate or retrieve the initial dataset summary using Gemini"""
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {id} not found."
        )

    # Resolve or initialize chat session
    session = db.query(ChatSession).filter(ChatSession.dataset_id == id).order_by(ChatSession.created_at.desc()).first()
    if not session:
        session = ChatSession(dataset_id=id)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Check for existing generated summary to save tokens
    first_msg = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id,
        ChatMessage.role == "assistant"
    ).order_by(ChatMessage.timestamp.asc()).first()

    if first_msg:
        return DatasetSummaryResponse(summary=first_msg.content)

    # Gather data details
    df = load_dataframe(dataset)
    sample_data = df.head(5).replace({np.nan: None}).to_dict(orient="records")
    datatypes = {col: str(dtype) for col, dtype in dict(df.dtypes).items()}

    ai_service = GeminiService()
    try:
        summary_text = await ai_service.generate_summary(
            filename=dataset.original_filename,
            filesize=dataset.file_size,
            rows=dataset.rows,
            columns=dataset.columns,
            datatypes=datatypes,
            sample_rows=sample_data
        )
    except Exception as e:
        from app.services.ai.gemini_service import GeminiError
        err_msg = str(e) if isinstance(e, GeminiError) else f"Network unavailable ({str(e)})"
        summary_text = f"Welcome! Gemini Summary generation was not completed: {err_msg}. However, your workspace contains {dataset.rows} rows and {dataset.columns} columns and is ready for analytics queries."

    # Save as first AI assistant message
    summary_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=summary_text,
        type="text"
    )
    db.add(summary_msg)
    db.commit()

    return DatasetSummaryResponse(summary=summary_text)

@router.post("/{id}/chat", response_model=ChatResponse)
async def query_dataset_chatbot(id: str, request: ChatRequest, db: Session = Depends(get_db)):
    """Run interactive natural language chat workspace query against active dataset"""
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {id} not found."
        )

    # Fetch corresponding session
    session_id = request.session_id
    session = None
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.dataset_id == id).first()
    if not session:
        session = db.query(ChatSession).filter(ChatSession.dataset_id == id).order_by(ChatSession.created_at.desc()).first()
    if not session:
        session = ChatSession(dataset_id=id)
        db.add(session)
        db.commit()
        db.refresh(session)

    user_query = request.message

    # 1. Log User message to database
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=user_query,
        type="text"
    )
    db.add(user_msg)
    db.commit()

    # 2. Extract column profiling data
    columns_list = []
    columns_profile = dataset.profile_data.get("columns", {}) if dataset.profile_data else {}
    for col_name, details in columns_profile.items():
        columns_list.append({
            "name": col_name,
            "data_type": details.get("data_type", "object"),
            "missing_count": details.get("missing_count", 0),
            "uniques": details.get("distinct_count", 0),
            "sample_values": details.get("stats", {}).get("top_values", [])[:3] if "stats" in details else []
        })

    ai_service = GeminiService()
    reply_message = ""
    insights = []
    plotly_spec = None
    response_type = "text"

    try:
        # Load dataset
        df = load_dataframe(dataset)

        # 3. Request intent and calculations code from Gemini classifier
        intent = await ai_service.determine_intent(user_query, columns_list)
        intent_type = intent.get("intent", "general")
        pandas_code = intent.get("pandas_code", "")
        chart_config = intent.get("chart_config", None)

        if intent_type in ("pandas", "visualization") and pandas_code:
            # 4. Safe Python execution
            execution = execute_pandas_calculations(df, pandas_code)
            
            if execution["success"]:
                result_context = json.dumps(execution["result"], default=str)
                # 5. Ask Gemini to convert output into a descriptive explanation
                reply_message = await ai_service.explain_results(user_query, result_context)
                
                # Check for Plotly visualizations configuration mapping
                if intent_type == "visualization" or chart_config:
                    plotly_spec = generate_plotly_spec(df, chart_config)
                    if plotly_spec:
                        response_type = "chart"
            else:
                # Code execution failed, explain statistics context instead
                error_ctx = f"Pandas execution failed: {execution.get('error', '')}. Fallback statistical explanation."
                reply_message = await ai_service.explain_results(user_query, error_ctx)
        else:
            # General discussion
            stats_ctx = f"Dataset size: {dataset.rows} rows and {dataset.columns} columns. Columns details: {json.dumps(columns_list, default=str)}"
            reply_message = await ai_service.explain_results(user_query, stats_ctx)

        # Extract list of insights from formatted response (bullet points)
        bullets = [line.strip("- *").strip() for line in reply_message.split("\n") if line.strip().startswith("-") or line.strip().startswith("*")]
        if bullets:
            insights = bullets[:3]

    except Exception as e:
        from app.services.ai.gemini_service import GeminiError
        err_msg = str(e) if isinstance(e, GeminiError) else f"Network unavailable ({str(e)})"
        reply_message = f"I encountered an error trying to process your dataset query: {err_msg}"
        response_type = "text"

    # 6. Save assistant message to DB
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=reply_message,
        type=response_type,
        chart_data=plotly_spec,
        insights=insights
    )
    db.add(assistant_msg)
    db.commit()

    return ChatResponse(
        message=reply_message,
        type=response_type,
        chart=plotly_spec,
        insights=insights,
        session_id=session.id
    )

@router.post("/{id}/visualize", response_model=ChatResponse)
async def generate_visualization(id: str, request: ChatRequest, db: Session = Depends(get_db)):
    """Shortcut endpoint to visualize columns in active dataset"""
    # Enforce visualization intent prefix inside prompt request
    request.message = f"Generate a visualization/chart representing: {request.message}"
    return await query_dataset_chatbot(id, request, db)

@router.get("/{id}/chat/history", response_model=list[ChatMessageResponse])
def get_chat_history_by_id(id: str, db: Session = Depends(get_db)):
    """Retrieve historical chatbot logs for active dataset"""
    session = db.query(ChatSession).filter(ChatSession.dataset_id == id).order_by(ChatSession.created_at.desc()).first()
    if not session:
        return []
    return session.messages

@router.delete("/{id}/chat/history", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_history_by_id(id: str, db: Session = Depends(get_db)):
    """Clear analytical chat sessions for active dataset"""
    sessions = db.query(ChatSession).filter(ChatSession.dataset_id == id).all()
    for s in sessions:
        db.delete(s)
    db.commit()
    return

# --- Compatibility Aliases ---

@router.get("/chat/history/{dataset_id}", response_model=list[ChatMessageResponse])
def get_chat_history_alias(dataset_id: str, db: Session = Depends(get_db)):
    """Alias for history retrieval"""
    return get_chat_history_by_id(dataset_id, db)

@router.delete("/chat/history/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_history_alias(dataset_id: str, db: Session = Depends(get_db)):
    """Alias for deleting history"""
    return delete_chat_history_by_id(dataset_id, db)
