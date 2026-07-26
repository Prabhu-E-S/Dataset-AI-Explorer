from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional, Union

# --- Cleaning Operation schemas ---
class CleaningOperationBase(BaseModel):
    cleaner_name: str
    parameters: Optional[Dict[str, Any]] = None
    rows_affected: int = 0

class CleaningOperationResponse(CleaningOperationBase):
    id: str
    session_id: str

    class Config:
        from_attributes = True

# --- Cleaning Report schemas ---
class CleaningReportBase(BaseModel):
    executive_summary: str
    problems_found: List[Any]
    actions_taken: List[Any]
    statistics: Optional[Dict[str, Any]] = None
    future_suggestions: List[str]

class CleaningReportResponse(CleaningReportBase):
    id: str
    session_id: str

    class Config:
        from_attributes = True

# --- Cleaning Session schemas ---
class CleaningSessionBase(BaseModel):
    dataset_id: str
    quality_score_before: int
    quality_score_after: int

class CleaningSessionResponse(CleaningSessionBase):
    id: str
    timestamp: datetime
    operations: List[CleaningOperationResponse] = []
    report: Optional[CleaningReportResponse] = None

    class Config:
        from_attributes = True

# --- Download History schemas ---
class DownloadHistoryBase(BaseModel):
    dataset_id: str
    file_format: str

class DownloadHistoryResponse(DownloadHistoryBase):
    id: str
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Interactive Clean Request / Response schemas ---
class ApplyCleaningRequest(BaseModel):
    # Mapping of cleaner names to boolean/parameters dictionary.
    # E.g. {"duplicate_cleaner": true, "missing_value_cleaner": {"strategy": "median"}}
    operations: Dict[str, Any]

class CleanMetricCompare(BaseModel):
    metric: str # rows, columns, missing_values, duplicate_rows, memory_usage_bytes, quality_score
    before: Union[int, float, str]
    after: Union[int, float, str]
    pct_impr: Optional[float] = None

class ApplyCleaningResponse(BaseModel):
    session_id: str
    quality_score_before: int
    quality_score_after: int
    operations: List[Dict[str, Any]] # Applied cleaner logs
    comparison: List[CleanMetricCompare]
    download_links: Dict[str, str]

# --- Quality Inspection schemas ---
class QualityIssueBreakdown(BaseModel):
    completeness: int
    consistency: int
    validity: int
    accuracy: int
    uniqueness: int
    timeliness: int

class QualityIssueDetails(BaseModel):
    category: str # e.g. "missing", "duplicate", "invalid_type", "outlier", "inconsistent"
    column: Optional[str] = None
    description: str
    recommendation: str
    findings_severity: str = "medium" # "low", "medium", "high"

class QualityReportResponse(BaseModel):
    quality_score: int
    breakdown: QualityIssueBreakdown
    issues: List[QualityIssueDetails]
    recommendations: List[str]
