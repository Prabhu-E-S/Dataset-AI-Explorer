import os
import sys
import shutil

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# 1. Override environment variables prior to import settings module
os.environ["DATABASE_URL"] = "sqlite:///./test_api.db"
os.environ["UPLOAD_DIR"] = "test_uploads"

# Create dummy uploads folder
os.makedirs("test_uploads", exist_ok=True)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.database import Base, get_db
from app.main import app

# 2. Setup SQLite database for API Test Session
SQLITE_URL = "sqlite:///./test_api.db"
engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Recreate tables in sqlite
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Apply dependency override
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_datasets_e2e_flow():
    print("\n--- Running End-to-End API Integration Tests ---")
    
    # 1. Create a dummy CSV file (numeric, categorical and missing values)
    csv_content = (
        "name,age,income,city\n"
        "Alice,25,50000.0,New York\n"
        "Bob,30,60000.0,Boston\n"
        "Charlie,35,,Chicago\n" # Missing value on income
        "David,,75000.0,New York\n" # Missing value on age
        "Eve,40,90000.0,\n"     # Missing value on city
        "Alice,25,50000.0,New York\n" # Duplicate row
    )
    
    csv_file_path = "test_sample.csv"
    with open(csv_file_path, "w") as f:
        f.write(csv_content)

    try:
        # 2. Upload file via API
        print("1. Testing POST /api/datasets/upload...")
        with open(csv_file_path, "rb") as f:
            response = client.post(
                "/api/datasets/upload",
                files={"file": ("test_sample.csv", f, "text/csv")}
            )
        
        assert response.status_code == 201, f"Failed upload: {response.text}"
        dataset = response.json()
        assert dataset["original_filename"] == "test_sample.csv"
        assert dataset["file_type"] == "csv"
        assert dataset["rows"] == 6
        assert dataset["columns"] == 4
        
        dataset_id = dataset["id"]
        filenameOnDisk = dataset["filename"]
        print(f"✓ Upload Success. Allocated workspace id: {dataset_id}")

        # Verify file is saved in test_uploads
        assert os.path.exists(os.path.join("test_uploads", filenameOnDisk))
        print("✓ Physical file verified on disk.")

        # 3. Retrieve Datasets List
        print("2. Testing GET /api/datasets...")
        response = client.get("/api/datasets")
        assert response.status_code == 200
        dataset_list = response.json()
        assert len(dataset_list) >= 1
        assert any(d["id"] == dataset_id for d in dataset_list)
        print("✓ Datasets listing success.")

        # 4. Fetch Dataset Profile
        print("3. Testing GET /api/datasets/{id}/profile...")
        response = client.get(f"/api/datasets/{dataset_id}/profile")
        assert response.status_code == 200
        profile = response.json()
        
        # Verify stats calculations
        pd_data = profile["profile_data"]
        assert pd_data["dimensions"]["rows"] == 6
        assert pd_data["dimensions"]["columns"] == 4
        assert pd_data["duplicate_rows"] == 1
        assert pd_data["missing_values_total"] == 3 # age, income, city

        # Age column checks (Numeric)
        age_col = pd_data["columns"]["age"]
        assert age_col["data_type"].startswith("float") or age_col["data_type"].startswith("int")
        assert age_col["missing_count"] == 1
        assert age_col["stats"]["min"] == 25.0
        assert age_col["stats"]["max"] == 40.0
        
        # City column checks (Categorical)
        city_col = pd_data["columns"]["city"]
        assert city_col["missing_count"] == 1
        assert len(city_col["stats"]["top_values"]) > 0
        print("✓ Pandas-based statistical profiling verified successfully.")

        # 5. Fetch Dataset Preview
        print("4. Testing GET /api/datasets/{id}/preview...")
        response = client.get(f"/api/datasets/{dataset_id}/preview")
        assert response.status_code == 200
        preview = response.json()
        assert preview["id"] == dataset_id
        assert len(preview["data"]) == 6
        assert preview["columns"] == ["name", "age", "income", "city"]
        
        # Check that NaN from missing fields mapped to JSON nulls
        assert preview["data"][2]["income"] is None # Charlie missing income
        assert preview["data"][3]["age"] is None # David missing age
        assert preview["data"][4]["city"] is None # Eve missing city
        print("✓ Preview JSON-clean rendering (NaN to null replacement) verified.")

        # 6. Delete Dataset
        print("5. Testing DELETE /api/datasets/{id}...")
        response = client.delete(f"/api/datasets/{dataset_id}")
        assert response.status_code == 204
        
        # Verify db record removal
        response = client.get(f"/api/datasets/{dataset_id}")
        assert response.status_code == 404
        
        # Verify disk file removal
        assert not os.path.exists(os.path.join("test_uploads", filenameOnDisk))
        print("✓ Deletion & filesystem cleaning verified successfully.")

        print("\n=== ALL E2E API VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

    finally:
        # Clean up files
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)

if __name__ == "__main__":
    try:
        test_datasets_e2e_flow()
    except AssertionError as e:
        print("✗ Assertion failed during testing:", e)
        sys.exit(1)
    except Exception as e:
        print("✗ Unexpected error running test suite:", e)
        sys.exit(1)
    finally:
        # Cleanup test directories and db
        # Dispose engine connections to release file handles under Windows
        try:
            engine.dispose()
        except Exception:
            pass
            
        if os.path.exists("test_uploads"):
            try:
                shutil.rmtree("test_uploads")
            except Exception:
                pass
                
        if os.path.exists("test_api.db"):
            try:
                os.remove("test_api.db")
            except Exception:
                pass
