import os
import sys

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Override environment variables prior to importing dependencies
os.environ["DATABASE_URL"] = "sqlite:///./test_api.db"
os.environ["UPLOAD_DIR"] = "test_uploads"

# Create test uploads directory
os.makedirs("test_uploads", exist_ok=True)

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import Base, engine, SessionLocal
from app.models.dataset import Dataset
from app.models.chat import ChatSession, ChatMessage

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: Create fresh database tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean tables
    db.query(ChatMessage).delete()
    db.query(ChatSession).delete()
    db.query(Dataset).delete()
    db.commit()
    db.close()
    yield
    # Teardown
    db = SessionLocal()
    db.query(ChatMessage).delete()
    db.query(ChatSession).delete()
    db.query(Dataset).delete()
    db.commit()
    db.close()
    # Clean up test database file
    if os.path.exists("test_api.db"):
        try:
            os.remove("test_api.db")
        except Exception:
            pass

@patch("app.routers.datasets.GeminiService")
def test_ai_endpoints_lifecycle(mock_gemini_class):
    # Mock Gemini Service responses
    mock_instance = MagicMock()
    mock_instance.generate_summary = AsyncMock(return_value="This is a mock welcome dataset summary.")
    mock_instance.explain_results = AsyncMock(return_value="Following calculations, here is the explanation:\n- Insight 1: Positive correlation.\n- Insight 2: Outliers present.")
    mock_instance.determine_intent = AsyncMock(return_value={
        "intent": "pandas",
        "pandas_code": "result = df.describe().to_dict()",
        "chart_config": None
    })
    mock_gemini_class.return_value = mock_instance

    # 1. Setup mock active Dataset record in database
    db = SessionLocal()
    dataset = Dataset(
        id="test_dataset_ai_123",
        filename="test_dataset.csv",
        original_filename="Sample Data.csv",
        file_type="csv",
        rows=10,
        columns=3,
        file_size=1024,
        profile_data={"columns": {"age": {"data_type": "int", "missing_count": 0, "distinct_count": 5}}}
    )
    db.add(dataset)
    db.commit()
    db.close()

    # Create local file mock in test_uploads folder
    with open("test_uploads/test_dataset.csv", "w") as f:
        f.write("age,income,gender\n25,50000,M\n30,60000,F\n35,70000,M")

    client = TestClient(app)
    try:
        # 2. Test Get Summary Endpoint
        summary_resp = client.post("/api/datasets/test_dataset_ai_123/summary")
        assert summary_resp.status_code == 201
        res_data = summary_resp.json()
        assert "summary" in res_data
        assert res_data["summary"] == "This is a mock welcome dataset summary."

        # Verify chat session and welcome message got recorded in db
        db = SessionLocal()
        sessions = db.query(ChatSession).filter(ChatSession.dataset_id == "test_dataset_ai_123").all()
        assert len(sessions) == 1
        messages = db.query(ChatMessage).filter(ChatMessage.session_id == sessions[0].id).all()
        assert len(messages) == 1
        assert messages[0].role == "assistant"
        db.close()

        # 3. Test Chat Query Endpoint
        chat_payload = {
            "message": "Give me statistics on age column",
            "session_id": sessions[0].id
        }
        chat_resp = client.post("/api/datasets/test_dataset_ai_123/chat", json=chat_payload)
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()
        assert "message" in chat_data
        assert "type" in chat_data
        assert chat_data["type"] == "text"
        assert len(chat_data["insights"]) == 2
        assert chat_data["insights"][0] == "Insight 1: Positive correlation."

        # Verify database recorded both user question and assistant answer
        db = SessionLocal()
        messages = db.query(ChatMessage).filter(ChatMessage.session_id == sessions[0].id).order_by(ChatMessage.timestamp.asc()).all()
        assert len(messages) == 3 # welcome summary + user query + assistant answer
        assert messages[1].role == "user"
        assert messages[2].role == "assistant"
        db.close()

        # 4. Test Chat History Retrieval
        h_resp = client.get("/api/datasets/test_dataset_ai_123/chat/history")
        assert h_resp.status_code == 200
        history_list = h_resp.json()
        assert len(history_list) == 3
        assert history_list[1]["role"] == "user"

        # 5. Test History Deletion
        del_resp = client.delete("/api/datasets/test_dataset_ai_123/chat/history")
        assert del_resp.status_code == 204

        # Verify tables cleared
        h_resp_after = client.get("/api/datasets/test_dataset_ai_123/chat/history")
        assert h_resp_after.status_code == 200
        assert len(h_resp_after.json()) == 0

    finally:
        # Clean up mock file and directory
        if os.path.exists("test_uploads/test_dataset.csv"):
            os.remove("test_uploads/test_dataset.csv")
        if os.path.exists("test_uploads"):
            try:
                os.rmdir("test_uploads")
            except Exception:
                pass
        # Clear test DB file if remaining
        if os.path.exists("test_api.db"):
            try:
                os.remove("test_api.db")
            except Exception:
                pass
