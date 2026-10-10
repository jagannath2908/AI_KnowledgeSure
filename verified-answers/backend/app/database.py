import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

# Ensure DB directories exist if using sqlite
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_db():
    """Initializes extensions and tables in the database."""
    # Ensure all models are imported so Base.metadata contains all tables
    import app.models

    try:
        # If postgres, enable vector extension
        if "postgresql" in settings.DATABASE_URL.lower():
            with engine.connect() as connection:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                connection.commit()
                logger.info("Successfully ensured 'vector' extension is active.")
    except Exception as e:
        logger.warning(f"Could not enable pgvector extension automatically: {e}")

    # Create tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created.")

    # Seed default demo accounts if database is empty
    try:
        from app.security import hash_password
        db = SessionLocal()
        user_count = db.query(app.models.User).count()
        if user_count == 0:
            admin_user = app.models.User(
                email="admin@verifiedanswers.io",
                hashed_password=hash_password("AdminPass123!"),
                full_name="Compliance Admin",
                role="admin"
            )
            analyst_user = app.models.User(
                email="analyst@verifiedanswers.io",
                hashed_password=hash_password("UserPass123!"),
                full_name="Risk Analyst",
                role="user"
            )
            db.add_all([admin_user, analyst_user])
            db.commit()
            logger.info("Seeded default demo accounts (admin@verifiedanswers.io, analyst@verifiedanswers.io).")
        db.close()
    except Exception as seed_err:
        logger.warning(f"Demo user auto-seed notice: {seed_err}")

def get_db():
    """Yield a database session and safely close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
