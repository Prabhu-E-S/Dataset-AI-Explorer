import os
import sys

# Override environment variables prior to importing backend app
os.environ["DATABASE_URL"] = "sqlite:///./test_api.db"
os.environ["UPLOAD_DIR"] = "uploads"

import pandas as pd
import json
from fastapi.testclient import TestClient

# Adjust path to import backend modules correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database.database import SessionLocal, Base
from app.models.dataset import Dataset
from app.models.cleaning import CleaningSession, CleaningOperation, CleaningReport, DownloadHistory

client = TestClient(app)

def setup_dirty_dataset():
    """Generates a dirty CSV dataset and inserts a record in databases."""
    db = SessionLocal()
    
    # Create upload directory if missing
    os.makedirs("uploads", exist_ok=True)
    csv_path = os.path.abspath("uploads/dirty_test_data.csv")
    
    # Construct DataFrame with typical data defects:
    # 1. Duplicates
    # 2. Missing values
    # 3. Off-standard dates
    # 4. Outliers
    # 5. Invalid email structures
    # 6. Spacing details
    data = {
        "user_id": [1, 2, 2, 3, 4, 5],
        "name": [" John Doe ", "Jane Smith", "Jane Smith", "Bob  Marley", "Alice Cooper", "Charlie Brown"],
        "email": ["john.doe@example.com", "jane.smith@example", "jane.smith@example", "bob@example.com", "invalid-email", "charlie@web.com"],
        "date_registered": ["2023-01-15", "15/02/2023", "15/02/2023", "2023-03-20 10:00:00", "2023/04/25", None],
        "salary": [50000, 60000, 60000, 1200000, None, 45000],  # Outlier and missing
        "active": ["True", "False", "False", "Yes", "No", None]
    }
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    
    # Clear any previous test records
    db.query(Dataset).filter(Dataset.original_filename == "dirty_test_data.csv").delete()
    db.commit()
    
    # Register dataset in database
    dataset_rec = Dataset(
        filename="dirty_test_data.csv",
        original_filename="dirty_test_data.csv",
        file_type="csv",
        rows=len(df),
        columns=len(df.columns),
        file_size=os.path.getsize(csv_path),
        profile_data={}
    )
    db.add(dataset_rec)
    db.commit()
    db.refresh(dataset_rec)
    db.close()
    
    print(f"[TEST SETUP] Created dirty dataset with ID: {dataset_rec.id} in SQLite registry.")
    return dataset_rec.id, csv_path

def test_rest_endpoints(dataset_id):
    """Executes Rest API requests using FastApi TestClient wrapper."""
    print("\n--- Testing GET /api/quality-report ---")
    response = client.post("/api/quality-report", json={"dataset_id": dataset_id})
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    report_json = response.json()
    print("Quality Score:", report_json.get("quality_score"))
    print("Breakdown Keys:", list(report_json.get("breakdown", {}).keys()))
    print("Issues Count:", len(report_json.get("issues", [])))
    
    print("\n--- Testing POST /api/clean (Gemini Recommendation) ---")
    # To run test without Gemini token blockages, we simulate or ensure it handles standard fallback
    response = client.post("/api/clean", json={"dataset_id": dataset_id, "message": "Suggest cleaning strategies"})
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    clean_rec = response.json()
    print("Recommendation Prompt Length:", len(clean_rec.get("message", "")))

    print("\n--- Testing POST /api/datasets/{id}/apply-cleaning ---")
    operations_payload = {
        "operations": {
            "duplicate_cleaner": {"keep": "first"},
            "text_cleaner": {"trim_spaces": True, "case": "none", "remove_extra_spaces": True},
            "validator": {"email_columns": [], "phone_columns": []},
            "datetime_cleaner": {"output_format": "%Y-%m-%d"},
            "outlier_cleaner": {"strategy": "clamp"},
            "missing_value_cleaner": {"strategy": "median"},
            "datatype_cleaner": {"downcast_numeric": True, "normalize_booleans": True, "category_conversion": True}
        }
    }
    response = client.post(f"/api/datasets/{dataset_id}/apply-cleaning", json=operations_payload)
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    clean_res = response.json()
    print("Score Before:", clean_res.get("quality_score_before"))
    print("Score After:", clean_res.get("quality_score_after"))
    print("Operations Count Applied:", len(clean_res.get("operations", [])))
    print("Metrics Comparison Items:", len(clean_res.get("comparison", [])))

    print("\n--- Testing GET /api/datasets/{id}/cleaning/history ---")
    response = client.get(f"/api/cleaning/history/{dataset_id}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    history = response.json()
    print("History Entries Count:", len(history))
    if len(history) > 0:
        print("First Entry Session ID:", history[0].get("id"))
        
    print("\n--- Testing GET /api/datasets/download/report/{id} (PDF Generation) ---")
    response = client.get(f"/api/datasets/download/report/{dataset_id}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    print("Content-Type Returned:", response.headers.get("content-type"))
    print("Body Length (PDF size in bytes):", len(response.content))
    assert response.content.startswith(b"%PDF")

    print("\n--- Testing GET /api/datasets/download/csv/{id} ---")
    response = client.get(f"/api/datasets/download/csv/{dataset_id}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    import io
    cleaned_df = pd.read_csv(io.StringIO(response.text))
    print("Cleaned DataFrame Rows Count:", len(cleaned_df))
    print("Cleaned DataFrame Sample Column Values ('name'):")
    print(cleaned_df["name"].tolist())
    
    print("\n--- E2E REST ENDPOINTS INTEGRATION TESTING COMPLETED - ALL PASS ---")

if __name__ == "__main__":
    try:
        dataset_id, csv_path = setup_dirty_dataset()
        test_rest_endpoints(dataset_id)
        
        # Clean local file registry row after test
        db = SessionLocal()
        db.query(Dataset).filter(Dataset.id == dataset_id).delete()
        db.commit()
        db.close()
        
        # Delete generated files to keep repository pristine
        if os.path.exists(csv_path):
            os.remove(csv_path)
            
        print("\nPristine environment cleaned up.")
    except Exception as e:
        print(f"\n[TEST FAILURE] E2E verification failed: {e}")
        sys.exit(1)
