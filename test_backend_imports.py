import sys
import os

# Align python path to backend root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

print("Verifying backend code modules integrity...")

try:
    from app.config import settings
    print("✓ app.config loaded successfully (Upload dir: {})".format(settings.UPLOAD_DIR))
except Exception as e:
    print("✗ Failed to load app.config settings: {}".format(e))
    sys.exit(1)

try:
    from app.database.database import get_db, Base
    print("✓ app.database core configurations loaded successfully")
except Exception as e:
    print("✗ Failed to load app.database module: {}".format(e))
    sys.exit(1)

try:
    from app.models.dataset import Dataset
    print("✓ app.models.dataset model loaded successfully")
except Exception as e:
    print("✗ Failed to load app.models.dataset model: {}".format(e))
    sys.exit(1)

try:
    from app.schemas.dataset import DatasetResponse, DatasetProfileResponse
    print("✓ app.schemas.dataset response models loaded successfully")
except Exception as e:
    print("✗ Failed to load app.schemas.dataset serializers: {}".format(e))
    sys.exit(1)

try:
    from app.services.profiler import profile_dataset
    print("✓ app.services.profiler engine loaded successfully")
except Exception as e:
    print("✗ Failed to load app.services.profiler engine: {}".format(e))
    sys.exit(1)

try:
    from app.services.storage import save_uploaded_file
    print("✓ app.services.storage manager loaded successfully")
except Exception as e:
    print("✗ Failed to load app.services.storage manager: {}".format(e))
    sys.exit(1)

try:
    from app.routers.datasets import router as dataset_router
    print("✓ app.routers.datasets router loaded successfully")
except Exception as e:
    print("✗ Failed to load app.routers.datasets router: {}".format(e))
    sys.exit(1)

try:
    # Just inspect imports of main to make sure it doesn't crash on standard libraries
    import fastapi
    import uvicorn
    print("✓ External frameworks (FastAPI, Uvicorn) are present")
except Exception as e:
    print("✗ Third-party modules check failed: {}".format(e))
    sys.exit(1)

print("\nAll backend modules resolved successfully! Code compilation integrity check passed.")
