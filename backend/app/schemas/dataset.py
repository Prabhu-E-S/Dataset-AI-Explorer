from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, Any, List, Optional

class DatasetBase(BaseModel):
    original_filename: str
    file_type: str
    rows: int
    columns: int
    file_size: int

class DatasetCreate(DatasetBase):
    filename: str

class DatasetResponse(DatasetBase):
    id: str
    filename: str
    upload_time: datetime

    class Config:
        from_attributes = True

class DatasetProfileResponse(DatasetResponse):
    profile_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class DatasetPreviewResponse(BaseModel):
    id: str
    filename: str
    columns: List[str]
    # Data is represented as a list of dicts: [{"col1": val1, "col2": val2}, ...]
    data: List[Dict[str, Any]]
    total_preview_rows: int
    total_dataset_rows: int
