import os
from dotenv import load_dotenv

# Resolve absolute path to backend/.env
config_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(os.path.dirname(config_dir), ".env")
env_exists = os.path.exists(env_path)

if env_exists:
    load_dotenv(dotenv_path=env_path)

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ai_dataset_explorer"
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 50
    GEMINI_API_KEY: str = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=env_path,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
