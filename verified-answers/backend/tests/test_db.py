import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise ValueError("DATABASE_URL is missing from .env")

if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(database_url, pool_pre_ping=True)

try:
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT current_database(), current_user")
        )
        database, user = result.fetchone()

        print("Neon connection successful!")
        print("Database:", database)
        print("User:", user)

except Exception as e:
    print("Connection failed:", e)

finally:
    engine.dispose()