import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from app.database.database import Base

class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    name = Column(String, nullable=False) # e.g. 'Original', 'Cleaned V1', 'Predicted'
    filename = Column(String, nullable=False) # Local file name in UPLOAD_DIR
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    dataset = relationship("Dataset")


class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    algorithm = Column(String, nullable=False) # 'Linear Regression', 'Logistic Regression', etc.
    parameters = Column(JSON, nullable=True) # hyperparameters dictionary
    metrics = Column(JSON, nullable=True) # evaluation metrics (R2, RMSE, Accuracy etc.)
    feature_importances = Column(JSON, nullable=True) # feature name -> importance score dictionary
    model_path = Column(String, nullable=True) # Path to serialized joblib/pickle model
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    dataset = relationship("Dataset")
    predictions = relationship("Prediction", back_populates="model", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(String, ForeignKey("ml_models.id", ondelete="SET NULL"), nullable=True)
    target_column = Column(String, nullable=False)
    prediction_type = Column(String, nullable=False) # 'regression' or 'classification'
    metrics = Column(JSON, nullable=True) # score dictionary
    results_path = Column(String, nullable=False) # CSV file containing original + predicted column
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    dataset = relationship("Dataset")
    model = relationship("MLModel", back_populates="predictions")


class AnalyticsReport(Base):
    __tablename__ = "analytics_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(JSON, nullable=False) # stores business insights parameters structure
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    dataset = relationship("Dataset")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action_type = Column(String, nullable=False) # 'dataset_uploaded', 'cleaning_completed', etc.
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, nullable=False) # 'info', 'success', 'warning', 'error'
    read = Column(Boolean, default=False, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
