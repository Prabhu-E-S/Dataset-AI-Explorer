import os
import uuid
import shutil
from fastapi import UploadFile, HTTPException, status
from app.config import settings

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

def save_uploaded_file(file: UploadFile) -> tuple[str, str, str, int]:
    """
    Validate file size and extension, then save and return physical filename, original filename, file type, and file size.
    Returns:
        (unique_filename, original_filename, file_type, file_size_bytes)
    """
    original_filename = file.filename
    _, ext = os.path.splitext(original_filename.lower())
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only CSV and Excel (.xlsx, .xls) are allowed."
        )

    # Resolve a clean file type name
    file_type = "csv" if ext == ".csv" else "excel"

    # Temporary file storage to measure size accurately before processing
    temp_filename = f"temp_{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
    
    try:
        file_size = 0
        with open(temp_path, "wb") as buffer:
            # Read in chunks to prevent large files from hogging RAM
            while chunk := file.file.read(1024 * 1024): # 1MB chunks
                file_size += len(chunk)
                if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB."
                    )
                buffer.write(chunk)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to copy file upload: {str(e)}"
        )

    # Zero bytes validation
    if file_size == 0:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # Rename temp to unique final name
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    final_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    shutil.move(temp_path, final_path)

    return unique_filename, original_filename, file_type, file_size

def delete_local_file(filename: str):
    """Physically deletes the dataset file from local filesystem folder"""
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            # Silently fail or log in production
            pass
