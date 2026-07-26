from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional

class ChatMessageBase(BaseModel):
    role: str
    content: str
    type: str = "text"
    chart_data: Optional[Dict[str, Any]] = None
    insights: Optional[List[str]] = None

class ChatMessageResponse(ChatMessageBase):
    id: str
    session_id: str
    timestamp: datetime

    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    id: str
    dataset_id: str
    created_at: datetime
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    type: str # 'text', 'chart', 'insights'
    chart: Optional[Dict[str, Any]] = None
    insights: Optional[List[str]] = None
    session_id: str

class DatasetSummaryResponse(BaseModel):
    summary: str
