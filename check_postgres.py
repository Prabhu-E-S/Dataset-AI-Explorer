import psycopg2
import sys

print("Diagnosing active PostgreSQL connection...")
try:
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres")
    print("✓ PostgreSQL service is running and accessible on localhost:5432")
    conn.close()
    sys.exit(0)
except Exception as e:
    print("✗ Could not connect to PostgreSQL on localhost: 5432")
    print("  Details: {}".format(e))
    sys.exit(1)
