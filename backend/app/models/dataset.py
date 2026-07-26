from sqlalchemy import Column, String, Integer, DateTime, JSON
import uuid
from datetime import datetime
from app.database.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, unique=True, nullable=False)
    original_filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    rows = Column(Integer, nullable=False)
    columns = Column(Integer, nullable=False)
    file_size = Column(Integer, nullable=False)
    upload_time = Column(DateTime, default=datetime.utcnow)
    profile_data = Column(JSON, nullable=True) # Stores dictionary of calculated profile metrics
