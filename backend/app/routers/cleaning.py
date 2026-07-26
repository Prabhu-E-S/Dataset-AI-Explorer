import os
import re
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import io

from app.database.database import get_db
from app.models.dataset import Dataset
from app.models.cleaning import CleaningSession, CleaningOperation, CleaningReport, DownloadHistory
from app.models.chat import ChatSession, ChatMessage
from app.schemas.cleaning import (
    ApplyCleaningRequest,
    ApplyCleaningResponse,
    QualityReportResponse,
    QualityIssueBreakdown,
    QualityIssueDetails,
    CleanMetricCompare,
    CleaningSessionResponse
)
from app.services.cleaning.pipeline import CleaningPipeline
from app.services.ai.gemini_service import GeminiService
from app.services.pdf_generator import PDFReportGenerator
from app.config import settings

router = APIRouter(
    prefix="/api",
    tags=["cleaning"]
)

# Regular expressions
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
PHONE_REGEX = re.compile(r'^\+?[\d\s\-()]{7,15}$')

def scan_dataset_quality(df: pd.DataFrame) -> dict:
    """
    Scans the pandas DataFrame for dataset defects.
    """
    total_rows = len(df)
    total_cells = df.size if total_rows > 0 else 1

    issues = []
    
    # 1. Missing values
    missing_cells = int(df.isnull().sum().sum())
    missing_percent = (missing_cells / total_cells) * 100
    if missing_cells > 0:
        for col in df.columns:
            m_count = int(df[col].isnull().sum())
            if m_count > 0:
                issues.append(QualityIssueDetails(
                    category="missing",
                    column=col,
                    description=f"Contains {m_count} missing values ({((m_count/total_rows)*100):.1f}%).",
                    recommendation=f"Impute missing values using column median or mean.",
                    findings_severity="medium"
                ))

    # 2. Duplicate rows
    dup_rows = int(df.duplicated().sum())
    if dup_rows > 0:
        issues.append(QualityIssueDetails(
            category="duplicate",
            column=None,
            description=f"Found {dup_rows} identical duplicate rows.",
            recommendation="Drop duplicate rows keeping the first occurrence.",
            findings_severity="high"
        ))

    # 3. Duplicate columns
    dup_cols = []
    for i in range(len(df.columns)):
        for j in range(i + 1, len(df.columns)):
            col1 = df.columns[i]
            col2 = df.columns[j]
            if df[col1].equals(df[col2]):
                dup_cols.append(col2)
    if dup_cols:
        issues.append(QualityIssueDetails(
            category="duplicate_columns",
            column=None,
            description=f"Duplicate columns detected: {', '.join(dup_cols)}.",
            recommendation=f"Remove identical columns to reduce dimensionality.",
            findings_severity="medium"
        ))

    # 4. Spacing, emails, phone numbers & Negatives
    negative_indicative = ["age", "salary", "price", "quantity", "income", "amount", "cost", "revenue"]
    
    for col in df.columns:
        # Trailing/leading spacing
        if df[col].dtype == 'object':
            str_series = df[col].dropna().astype(str)
            space_count = int(str_series.apply(lambda x: x.startswith(' ') or x.endswith(' ')).sum())
            if space_count > 0:
                issues.append(QualityIssueDetails(
                    category="inconsistent",
                    column=col,
                    description=f"{space_count} values contain leading or trailing spaces.",
                    recommendation="Trim whitespace padding.",
                    findings_severity="low"
                ))

            # Empty strings
            empty_count = int(str_series.apply(lambda x: x.strip() == '').sum())
            if empty_count > 0:
                issues.append(QualityIssueDetails(
                    category="inconsistent",
                    column=col,
                    description=f"Contains {empty_count} blank or empty strings.",
                    recommendation="Convert blank text to standard Null/NaN representation.",
                    findings_severity="low"
                ))

            # Invalid emails / phone numbers
            if 'email' in col.lower():
                invalid_emails = int(str_series.apply(lambda x: not bool(EMAIL_REGEX.match(x))).sum())
                if invalid_emails > 0:
                    issues.append(QualityIssueDetails(
                        category="invalid_type",
                        column=col,
                        description=f"Detected {invalid_emails} values with invalid email formats.",
                        recommendation="Validate syntax regulations or discard corrupt email addresses.",
                        findings_severity="high"
                    ))

            if 'phone' in col.lower() or 'mobile' in col.lower():
                invalid_phones = int(str_series.apply(lambda x: not bool(PHONE_REGEX.match(x))).sum())
                if invalid_phones > 0:
                    issues.append(QualityIssueDetails(
                        category="invalid_type",
                        column=col,
                        description=f"Detected {invalid_phones} values with invalid telephone digits.",
                        recommendation="Format or strip invalid characters from telephone fields.",
                        findings_severity="medium"
                    ))

        # Negative checks where impossible
        if pd.api.types.is_numeric_dtype(df[col]):
            col_l = col.lower()
            if any(key in col_l for key in negative_indicative):
                neg_count = int((df[col].dropna() < 0).sum())
                if neg_count > 0:
                    issues.append(QualityIssueDetails(
                        category="invalid_type",
                        column=col,
                        description=f"Contains {neg_count} negative entries which is illogical for details in '{col}'.",
                        recommendation="Clamp values to zero or drop illogical rows.",
                        findings_severity="high"
                    ))

            # Outliers count check
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            if iqr > 0:
                lower = q1 - 1.5 * iqr
                upper = q3 + 1.5 * iqr
                outliers = int(((df[col] < lower) | (df[col] > upper)).sum())
                if outliers > 0:
                    issues.append(QualityIssueDetails(
                        category="outlier",
                        column=col,
                        description=f"Contains {outliers} outlier records outside IQR range boundaries.",
                        recommendation="Clamp outliers or drop extreme values.",
                        findings_severity="medium"
                    ))

    # Calculate Quality Score
    completeness = max(10, int(100 - (missing_percent * 2)))
    uniqueness = max(10, int(100 - ((dup_rows / max(1, total_rows)) * 100)))
    
    # Validity metrics based on invalid rows count
    invalid_issues_count = len([x for x in issues if x.category == "invalid_type"])
    validity = max(10, int(100 - (invalid_issues_count * 10)))
    
    consistency_issues = len([x for x in issues if x.category == "inconsistent"])
    consistency = max(10, int(100 - (consistency_issues * 8)))
    
    accuracy_outliers = len([x for x in issues if x.category == "outlier"])
    accuracy = max(10, int(100 - (accuracy_outliers * 5)))
    
    timeliness = 95 # Benchmark/timeliness defaults

    score = int((completeness + uniqueness + validity + consistency + accuracy + timeliness) / 6)
    score = min(100, max(10, score))

    breakdown = QualityIssueBreakdown(
        completeness=completeness,
        consistency=consistency,
        validity=validity,
        accuracy=accuracy,
        uniqueness=uniqueness,
        timeliness=timeliness
    )

    recommendations = []
    for issue in issues[:3]:
        recommendations.append(f"On column '{issue.column or 'global'}': {issue.recommendation}")
    if dup_rows > 0:
        recommendations.append("Deduplicate dataset rows to ensure statistical consistency.")

    return {
        "quality_score": score,
        "breakdown": breakdown,
        "issues": issues,
        "recommendations": recommendations if recommendations else ["Dataset quality is high! No immediate corrections needed."]
    }

def load_dataframe(dataset: Dataset) -> pd.DataFrame:
    file_path = os.path.join(settings.UPLOAD_DIR, dataset.filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"Physical file for dataset '{dataset.original_filename}' missing."
        )
    if dataset.file_type == 'csv':
        return pd.read_csv(file_path, low_memory=False)
    else:
        return pd.read_excel(file_path)

@router.post("/quality-report", response_model=QualityReportResponse)
def get_quality_report(payload: dict, db: Session = Depends(get_db)):
    """
    Generates a dataset quality profiling report.
    Payload: {"dataset_id": "UUID-goes-here"}
    """
    dataset_id = payload.get("dataset_id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Missing parameter dataset_id.")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    df = load_dataframe(dataset)
    report = scan_dataset_quality(df)
    return report

@router.post("/clean")
async def start_cleaning_chat(payload: dict, db: Session = Depends(get_db)):
    """
    Generates Gemini cleaning suggestions and analysis plans.
    Payload: {"dataset_id": "...", "message": "..."}
    """
    dataset_id = payload.get("dataset_id")
    message = payload.get("message", "")
    
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Missing parameter dataset_id.")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    df = load_dataframe(dataset)
    scan_report = scan_dataset_quality(df)

    # Compile prompt details for Gemini recommendation
    gemini = GeminiService()
    
    # Custom prompt text instructing quality recommendations
    system_prompt = (
        "You are a professional Senior Data Engineer.\n"
        "Analyze the following dataset defects report and provide a modular recommendation strategy in JSON format.\n"
        "List target columns, specific issues, recommended strategies, and explanations.\n"
        "Make sure to explain why your recommendations are optimal (e.g. 'Use median because age contains outliers').\n"
        "Return a JSON block containing:\n"
        "{\n"
        "  \"executive_summary\": \"string overview\",\n"
        "  \"recommendations\": [\"detailed string recommendations\"]\n"
        "}\n"
    )
    
    insp_summary = {
        "dataset_name": dataset.original_filename,
        "rows": dataset.rows,
        "columns": dataset.columns,
        "quality_score": scan_report["quality_score"],
        "issues_detected": [
            {"col": x.column, "type": x.category, "desc": x.description} 
            for x in scan_report["issues"]
        ]
    }

    try:
        user_instruct = f"User instruction: {message}\nInspection Report details: {json.dumps(insp_summary)}"
        response_text = await gemini.call_ai(system_prompt, user_instruct)
        
        # Strip JSON formatting delimiters if present
        cleaned_response = response_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_response)
    except Exception as e:
        print("Gemini recommendation service failed:", e)
        # Fallback recommendations if LLM fails
        data = {
            "executive_summary": "I analyzed your dataset and prepared standard cleaning configurations.",
            "recommendations": scan_report["recommendations"]
        }

    return {
        "message": data.get("executive_summary"),
        "recommendations": data.get("recommendations"),
        "quality_report": scan_report
    }

@router.post("/apply-cleaning", response_model=ApplyCleaningResponse)
def apply_cleaning(payload: ApplyCleaningRequest, db: Session = Depends(get_db)):
    """
    Executes raw pandas data cleaning pipeline.
    """
    # Wait, client request must include dataset_id
    # Since Pydantic ApplyCleaningRequest has operations dictionary, we can pack dataset_id into payload dict
    # or get it in our root payload
    # Let's read raw dictionary payload to retrieve dataset_id
    pass

@router.post("/datasets/{dataset_id}/apply-cleaning", response_model=ApplyCleaningResponse)
def apply_cleaning_direct(dataset_id: str, payload: ApplyCleaningRequest, db: Session = Depends(get_db)):
    """
    Runs selected cleaning pipeline configurations.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    pipeline = CleaningPipeline()
    df_raw = load_dataframe(dataset)
    
    # Calculate before stats
    initial_rows = len(df_raw)
    initial_cols = len(df_raw.columns)
    initial_nulls = int(df_raw.isnull().sum().sum())
    initial_dups = int(df_raw.duplicated().sum())
    initial_bytes = int(df_raw.memory_usage(deep=True).sum())
    
    report_before = scan_dataset_quality(df_raw)

    # 1. Execute cleaning pipeline
    df_cleaned, operations_applied = pipeline.execute(df_raw, payload.operations)

    # Calculate after stats
    final_rows = len(df_cleaned)
    final_cols = len(df_cleaned.columns)
    final_nulls = int(df_cleaned.isnull().sum().sum())
    final_dups = int(df_cleaned.duplicated().sum())
    final_bytes = int(df_cleaned.memory_usage(deep=True).sum())
    
    report_after = scan_dataset_quality(df_cleaned)

    # Save cleaned file on disk suffix '_cleaned'
    ext = ".csv" if dataset.file_type == "csv" else ".xlsx"
    clean_filename = f"{dataset.id}_cleaned{ext}"
    clean_filepath = os.path.join(settings.UPLOAD_DIR, clean_filename)

    if dataset.file_type == "csv":
        df_cleaned.to_csv(clean_filepath, index=False)
    else:
        df_cleaned.to_excel(clean_filepath, index=False)

    # 2. Record Cleaning Session in Database
    session = CleaningSession(
        dataset_id=dataset.id,
        quality_score_before=report_before["quality_score"],
        quality_score_after=report_after["quality_score"]
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Save applied operations
    ops_list = []
    for op in operations_applied:
        db_op = CleaningOperation(
            session_id=session.id,
            cleaner_name=op["cleaner_name"],
            parameters=op["parameters"],
            rows_affected=op["rows_affected"]
        )
        db.add(db_op)
        ops_list.append(db_op)

    # Cache AI summary descriptions
    issues_desc = [x.description for x in report_before["issues"]]
    recs_desc = [x.recommendation for x in report_before["issues"]]
    
    actions_desc = []
    for op in operations_applied:
        c_name = op["cleaner_name"].replace("_", " ").title()
        actions_desc.append({
            "cleaner_name": op["cleaner_name"],
            "parameters": op["parameters"],
            "rows_affected": op["rows_affected"]
        })

    report_model = CleaningReport(
        session_id=session.id,
        executive_summary=(
            f"Successfully executed cleaning workflows against dataset '{dataset.original_filename}'. "
            f"The overall dataset quality score improved from {session.quality_score_before}/100 to {session.quality_score_after}/100."
        ),
        problems_found=issues_desc,
        actions_taken=actions_desc,
        statistics={
            "initial_rows": initial_rows,
            "final_rows": final_rows,
            "initial_nulls": initial_nulls,
            "final_nulls": final_nulls,
            "initial_bytes": initial_bytes,
            "final_bytes": final_bytes
        },
        future_suggestions=[
            "Set schema validation on upstream datastore triggers.",
            "Sanitize leading and trailing whitespace strings in input forms."
        ]
    )
    db.add(report_model)
    
    # Update active dataset file to point to cleaned version
    dataset.filename = clean_filename
    dataset.rows = final_rows
    dataset.columns = final_cols
    dataset.file_size = final_bytes
    
    # Register new DatasetVersion
    from app.models.analytics import DatasetVersion, ActivityLog, Notification
    
    # Find latest version number
    latest_ver = db.query(DatasetVersion)\
        .filter(DatasetVersion.dataset_id == dataset.id)\
        .order_by(DatasetVersion.version_number.desc())\
        .first()
    next_ver = 1 if not latest_ver else latest_ver.version_number + 1
    
    version_record = DatasetVersion(
        dataset_id=dataset.id,
        version_number=next_ver,
        name=f"Cleaned Version (Session {session.id[:8]})",
        filename=clean_filename
    )
    db.add(version_record)
    
    activity = ActivityLog(
        action_type="dataset_cleaned",
        description=f"Applied cleaning workflows against dataset '{dataset.original_filename}'. Quality improved from {session.quality_score_before} to {session.quality_score_after}."
    )
    db.add(activity)
    
    notif = Notification(
        title="Dataset Cleaned",
        message=f"Cleaned dataset: {dataset.original_filename}. Quality score: {session.quality_score_after}/100",
        type="success"
    )
    db.add(notif)
    
    db.commit()

    # 3. Compile comparison breakdown JSON response
    def pct_change(bef, aft):
        if bef == 0:
            return 0.0
        return round(((bef - aft) / bef) * 100, 1)

    compare_metrics = [
        CleanMetricCompare(metric="Total Rows", before=initial_rows, after=final_rows, pct_impr=pct_change(initial_rows, final_rows)),
        CleanMetricCompare(metric="Total Columns", before=initial_cols, after=final_cols, pct_impr=pct_change(initial_cols, final_cols)),
        CleanMetricCompare(metric="Missing Values", before=initial_nulls, after=final_nulls, pct_impr=pct_change(initial_nulls, final_nulls)),
        CleanMetricCompare(metric="Duplicate Rows", before=initial_dups, after=final_dups, pct_impr=pct_change(initial_dups, final_dups)),
        CleanMetricCompare(metric="Quality Score", before=report_before["quality_score"], after=report_after["quality_score"], pct_impr=float(report_after["quality_score"] - report_before["quality_score"])),
        CleanMetricCompare(metric="Memory Footprint", before=f"{initial_bytes / 1024:.2f} KB", after=f"{final_bytes / 1024:.2f} KB", pct_impr=pct_change(initial_bytes, final_bytes))
    ]

    # Generate PDF physical report statically in background
    pdf_filename = f"Report_{session.id}.pdf"
    pdf_filepath = os.path.join(settings.UPLOAD_DIR, pdf_filename)
    
    comparison_dict = [{"metric": m.metric, "before": m.before, "after": m.after, "pct_impr": m.pct_impr} for m in compare_metrics]
    
    PDFReportGenerator.generate_report(
        dest_path=pdf_filepath,
        dataset_name=dataset.original_filename,
        report_data={
            "executive_summary": report_model.executive_summary,
            "problems_found": report_before["issues"],
            "actions_taken": operations_applied,
            "future_suggestions": report_model.future_suggestions
        },
        session_data={
            "id": session.id,
            "quality_score_before": session.quality_score_before,
            "quality_score_after": session.quality_score_after
        },
        stats_compare=comparison_dict
    )

    return ApplyCleaningResponse(
        session_id=session.id,
        quality_score_before=session.quality_score_before,
        quality_score_after=session.quality_score_after,
        operations=operations_applied,
        comparison=compare_metrics,
        download_links={
            "csv": f"/api/datasets/download/csv/{dataset.id}",
            "excel": f"/api/datasets/download/excel/{dataset.id}",
            "json": f"/api/datasets/download/json/{dataset.id}",
            "report": f"/api/datasets/download/report/{dataset.id}"
        }
    )

@router.post("/apply-cleaning", response_model=ApplyCleaningResponse)
def apply_cleaning_indirect(payload: dict, db: Session = Depends(get_db)):
    """
    Indirect handler mapping POST /apply-cleaning with body elements.
    """
    dataset_id = payload.get("dataset_id")
    operations = payload.get("operations", {})
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Missing dataset_id parametrisation.")
    
    # Map to typed request schema
    req = ApplyCleaningRequest(operations=operations)
    return apply_cleaning_direct(dataset_id, req, db)

@router.get("/cleaning/history/{dataset_id}", response_model=List[CleaningSessionResponse])
def get_cleaning_history(dataset_id: str, db: Session = Depends(get_db)):
    """
    Loads previous cleaning session runs records.
    """
    sessions = db.query(CleaningSession).filter(
        CleaningSession.dataset_id == dataset_id
    ).order_by(CleaningSession.timestamp.desc()).all()
    return sessions

# --- Downloads routes ---

def record_download(dataset_id: str, file_format: str, db: Session):
    try:
        download = DownloadHistory(
            dataset_id=dataset_id,
            file_format=file_format
        )
        db.add(download)
        db.commit()
    except Exception as e:
        print("Could not record download details:", e)

@router.get("/datasets/download/csv/{dataset_id}")
def download_csv(dataset_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset metadata not found.")

    # Check if there is a cleaned file version
    ext = ".csv" if dataset.file_type == "csv" else ".xlsx"
    clean_filename = f"{dataset.id}_cleaned{ext}"
    clean_filepath = os.path.join(settings.UPLOAD_DIR, clean_filename)

    record_download(dataset_id, "CSV", db)

    if os.path.exists(clean_filepath):
        if dataset.file_type == "csv":
            return FileResponse(clean_filepath, media_type="text/csv", filename=f"Cleaned_{dataset.original_filename}")
        else:
            # If original was Excel but cleaned is xlsx, convert cleaned Excel back to CSV streaming
            df = pd.read_excel(clean_filepath)
            stream = io.StringIO()
            df.to_csv(stream, index=False)
            response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
            response.headers["Content-Disposition"] = f"attachment; filename=Cleaned_{os.path.splitext(dataset.original_filename)[0]}.csv"
            return response
    else:
        # Stream original file as CSV if not cleaned yet
        orig_file = os.path.join(settings.UPLOAD_DIR, dataset.filename)
        if dataset.file_type == "csv":
            return FileResponse(orig_file, media_type="text/csv", filename=f"{dataset.original_filename}")
        else:
            df = pd.read_excel(orig_file)
            stream = io.StringIO()
            df.to_csv(stream, index=False)
            response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
            response.headers["Content-Disposition"] = f"attachment; filename={os.path.splitext(dataset.original_filename)[0]}.csv"
            return response

@router.get("/datasets/download/excel/{dataset_id}")
def download_excel(dataset_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset metadata not found.")

    ext = ".csv" if dataset.file_type == "csv" else ".xlsx"
    clean_filename = f"{dataset.id}_cleaned{ext}"
    clean_filepath = os.path.join(settings.UPLOAD_DIR, clean_filename)

    record_download(dataset_id, "EXCEL", db)

    # Compile stream bytes
    if os.path.exists(clean_filepath):
        if dataset.file_type == "excel":
            return FileResponse(clean_filepath, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=f"Cleaned_{dataset.original_filename}")
        else:
            df = pd.read_csv(clean_filepath)
            out_stream = io.BytesIO()
            with pd.ExcelWriter(out_stream, engine='openpyxl') as writer:
                df.to_excel(writer, index=False)
            out_stream.seek(0)
            orig_name_base = os.path.splitext(dataset.original_filename)[0]
            response = StreamingResponse(out_stream, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            response.headers["Content-Disposition"] = f"attachment; filename=Cleaned_{orig_name_base}.xlsx"
            return response
    else:
        orig_file = os.path.join(settings.UPLOAD_DIR, dataset.filename)
        if dataset.file_type == "excel":
            return FileResponse(orig_file, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=f"{dataset.original_filename}")
        else:
            df = pd.read_csv(orig_file)
            out_stream = io.BytesIO()
            with pd.ExcelWriter(out_stream, engine='openpyxl') as writer:
                df.to_excel(writer, index=False)
            out_stream.seek(0)
            orig_name_base = os.path.splitext(dataset.original_filename)[0]
            response = StreamingResponse(out_stream, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            response.headers["Content-Disposition"] = f"attachment; filename={orig_name_base}.xlsx"
            return response

@router.get("/datasets/download/json/{dataset_id}")
def download_json(dataset_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset metadata not found.")

    ext = ".csv" if dataset.file_type == "csv" else ".xlsx"
    clean_filename = f"{dataset.id}_cleaned{ext}"
    clean_filepath = os.path.join(settings.UPLOAD_DIR, clean_filename)

    record_download(dataset_id, "JSON", db)

    # Read and dump JSON
    target_path = clean_filepath if os.path.exists(clean_filepath) else os.path.join(settings.UPLOAD_DIR, dataset.filename)
    
    if dataset.file_type == "csv":
        df = pd.read_csv(target_path, low_memory=False)
    else:
        df = pd.read_excel(target_path)

    js_str = df.to_json(orient="records", indent=2)
    response = StreamingResponse(iter([js_str]), media_type="application/json")
    response.headers["Content-Disposition"] = f"attachment; filename=Cleaned_{os.path.splitext(dataset.original_filename)[0]}.json"
    return response

@router.get("/datasets/download/report/{dataset_id}")
def download_report(dataset_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset metadata not found.")

    # Find the latest cleaning session
    latest_session = db.query(CleaningSession).filter(
        CleaningSession.dataset_id == dataset_id
    ).order_by(CleaningSession.timestamp.desc()).first()

    if not latest_session:
        raise HTTPException(status_code=400, detail="No cleaning runs recorded for this dataset. Perform cleaning first.")

    pdf_filename = f"Report_{latest_session.id}.pdf"
    pdf_filepath = os.path.join(settings.UPLOAD_DIR, pdf_filename)

    if not os.path.exists(pdf_filepath):
        raise HTTPException(status_code=404, detail="Report PDF missing on server storage.")

    record_download(dataset_id, "REPORT_PDF", db)
    return FileResponse(pdf_filepath, media_type="application/pdf", filename=f"Cleaning_Report_{os.path.splitext(dataset.original_filename)[0]}.pdf")
