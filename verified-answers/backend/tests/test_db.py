
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise ValueError("DATABASE_URL not found in .env")

engine = create_engine(database_url)

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT current_database()"))
        print("Connected successfully!")
        print("Database:", result.scalar())
except Exception as e:
    print("Connection failed:", e)
finally:
    engine.dispose()
