import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse
from app.config import settings

def create_db_if_not_exists():
    """
    Connects to the default 'postgres' database and verifies if the targeted
    application database exists. If it does not exist, it runs a CREATE DATABASE statement.
    """
    try:
        url = urlparse(settings.DATABASE_URL)
        db_name = url.path.lstrip('/')
        
        username = url.username
        password = url.password
        host = url.hostname
        port = url.port or 5432
        
        # Connect to postgres default DB to check existence
        conn = psycopg2.connect(
            dbname="postgres",
            user=username,
            password=password,
            host=host,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s;", (db_name,))
        exists = cursor.fetchone()
        
        if not exists:
            print(f"[DB Utils] Database '{db_name}' not found. Creating database...")
            cursor.execute(f"CREATE DATABASE {db_name};")
            print(f"[DB Utils] Database '{db_name}' created successfully.")
        else:
            print(f"[DB Utils] Database '{db_name}' exists.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        # Log error, but don't crash startup: SQLAlchemy might connect if db pre-exists or SQLite is used
        print(f"[DB Utils] Warning: Could not auto-create database: {str(e)}")
