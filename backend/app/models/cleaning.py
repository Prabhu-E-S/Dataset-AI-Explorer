import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class CleaningSession(Base):
    __tablename__ = "cleaning_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    quality_score_before = Column(Integer, nullable=False)
    quality_score_after = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    operations = relationship("CleaningOperation", back_populates="session", cascade="all, delete-orphan")
    report = relationship("CleaningReport", back_populates="session", uselist=False, cascade="all, delete-orphan")
    dataset = relationship("Dataset")

class CleaningOperation(Base):
    __tablename__ = "cleaning_operations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("cleaning_sessions.id", ondelete="CASCADE"), nullable=False)
    cleaner_name = Column(String, nullable=False) # e.g. 'missing_value_cleaner', 'duplicate_cleaner'
    parameters = Column(JSON, nullable=True) # dictionary of cleaner configuration
    rows_affected = Column(Integer, default=0, nullable=False)

    # Relationships
    session = relationship("CleaningSession", back_populates="operations")

class CleaningReport(Base):
    __tablename__ = "cleaning_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("cleaning_sessions.id", ondelete="CASCADE"), nullable=False)
    executive_summary = Column(Text, nullable=False)
    problems_found = Column(JSON, nullable=False)
    actions_taken = Column(JSON, nullable=False)
    statistics = Column(JSON, nullable=True) # statistics before/after difference
    future_suggestions = Column(JSON, nullable=False)

    # Relationships
    session = relationship("CleaningSession", back_populates="report")

class DownloadHistory(Base):
    __tablename__ = "download_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    file_format = Column(String, nullable=False) # 'CSV', 'EXCEL', 'JSON', 'REPORT_PDF'
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    dataset = relationship("Dataset")
