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

client = TestClient(app)

def setup_test_dataset():
    """Generates a numeric dataset and registers it in the SQLite registry."""
    db = SessionLocal()
    
    # Create upload directory if missing
    os.makedirs("uploads", exist_ok=True)
    csv_path = os.path.abspath("uploads/analytics_test_data.csv")
    
    # Construct DataFrame with target column for predictive modeling:
    data = {
        "feature1": [float(i) * 1.1 for i in range(20)],
        "feature2": [i * 5 for i in range(20)],
        "target": [float(i) * 5.5 + float(i) * 2.5 for i in range(20)] # target = feature1 * 5 + feature2 / 2 approx
    }
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    
    # Clear any previous test records
    db.query(Dataset).filter(Dataset.original_filename == "analytics_test_data.csv").delete()
    db.commit()
    
    # Register dataset in database
    dataset_rec = Dataset(
        filename="analytics_test_data.csv",
        original_filename="analytics_test_data.csv",
        file_type="csv",
        rows=len(df),
        columns=len(df.columns),
        file_size=os.path.getsize(csv_path),
        profile_data={"columns": {"feature1": {"data_type": "float"}, "feature2": {"data_type": "int"}, "target": {"data_type": "float"}}}
    )
    db.add(dataset_rec)
    db.commit()
    db.refresh(dataset_rec)
    db.close()
    
    print(f"[TEST SETUP] Created analytics test dataset with ID: {dataset_rec.id}")
    return dataset_rec.id, csv_path

def test_analytics_endpoints(dataset_id):
    """Execures validation checks for prediction, AutoML recommendations, report generators, and logs."""
    
    # 1. Test GET /api/dashboard
    print("\n--- Testing GET /api/dashboard ---")
    response = client.get("/api/dashboard")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    db_summary = response.json()
    print("Dashboard Summary keys:", list(db_summary.keys()))
    assert "total_datasets" in db_summary
    assert "total_reports" in db_summary
    assert "storage_used_mb" in db_summary

    # 2. Test GET /api/activity
    print("\n--- Testing GET /api/activity ---")
    response = client.get("/api/activity")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    logs = response.json()
    print(f"Activity logs count: {len(logs)}")
    
    # 3. Test GET /api/notifications
    print("\n--- Testing GET /api/notifications ---")
    response = client.get("/api/notifications")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    notifs = response.json()
    print(f"Notifications list size: {len(notifs)}")
    
    # 4. Test GET /api/versions/{dataset_id}
    print("\n--- Testing GET /api/versions/{dataset_id} ---")
    response = client.get(f"/api/versions/{dataset_id}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    versions = response.json()
    print(f"Dataset versions count: {len(versions)}")

    # 5. Test AutoML recommend endpoint
    print("\n--- Testing GET /api/datasets/{id}/automl-recommend ---")
    response = client.get(f"/api/datasets/{dataset_id}/automl-recommend")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    automl_res = response.json()
    print("AutoML Recommendations:", list(automl_res.keys()))
    assert "prediction_type" in automl_res
    assert "recommended_algorithm" in automl_res

    # 6. Test POST /api/train-model
    print("\n--- Testing POST /api/train-model ---")
    train_payload = {
        "dataset_id": dataset_id,
        "target_column": "target",
        "algorithm": "Random Forest",
        "feature_columns": ["feature1", "feature2"]
    }
    response = client.post("/api/train-model", json=train_payload)
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print("Error details:", response.text)
    assert response.status_code == 200
    model_res = response.json()
    print("Model Training Result stats keys:", list(model_res.keys()))
    assert "model_id" in model_res
    assert "metrics" in model_res
    assert "feature_importances" in model_res

    # 7. Test POST /api/predict
    print("\n--- Testing POST /api/predict ---")
    predict_payload = {
        "dataset_id": dataset_id,
        "target_column": "target",
        "algorithm": "Regression",
        "feature_columns": ["feature1", "feature2"]
    }
    response = client.post("/api/predict", json=predict_payload)
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print("Error details:", response.text)
    assert response.status_code == 200
    predict_res = response.json()
    print("Predict Execution keys:", list(predict_res.keys()))
    assert "prediction_id" in predict_res
    assert "metrics" in predict_res
    assert "download_url" in predict_res

    # 8. Test POST /api/generate-report
    print("\n--- Testing POST /api/generate-report ---")
    report_payload = {
        "dataset_id": dataset_id,
        "title": "Business Intelligence Sales Profile"
    }
    response = client.post("/api/generate-report", json=report_payload)
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    report_res = response.json()
    print("Compiled Report keys:", list(report_res.keys()))
    assert "report_id" in report_res
    assert "title" in report_res
    assert "content" in report_res
    report_uid = report_res["report_id"]

    # 9. Test GET /api/reports and GET /api/reports/download/{format}/{id}
    print("\n--- Testing GET /api/reports ---")
    response = client.get("/api/reports")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    reports_feed = response.json()
    print(f"Reports in history feed: {len(reports_feed)}")
    assert any(rep["id"] == report_uid for rep in reports_feed)

    print("\n--- Testing GET /api/reports/download/pdf/{id} ---")
    response = client.get(f"/api/reports/download/pdf/{report_uid}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    print("Returned content-type:", response.headers.get("content-type"))
    assert response.content.startswith(b"%PDF")
    print("✓ Business Report PDF compiled and streamed successfully.")

    print("\n--- Testing GET /api/reports/download/html/{id} ---")
    response = client.get(f"/api/reports/download/html/{report_uid}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    assert response.text.strip().lower().startswith("<!doctype html>")
    print("✓ Business Report HTML compiled and streamed successfully.")

    print("\n--- Testing GET /api/reports/download/markdown/{id} ---")
    response = client.get(f"/api/reports/download/markdown/{report_uid}")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    print("✓ Business Report MD compiled and streamed successfully.")

    print("\n=== ALL PHASES 4 ANALYTICS VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    try:
        # Create schema tables if needed
        db = SessionLocal()
        Base.metadata.create_all(bind=db.bind)
        db.close()
        
        dataset_id, csv_path = setup_test_dataset()
        test_analytics_endpoints(dataset_id)
        
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
        import traceback
        traceback.print_exc()
        sys.exit(1)
