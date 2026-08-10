import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.base import Base 


DB_PATH = os.path.join(os.path.dirname(__file__), "..", "properties_data", "properties.db")
DB_PATH = os.path.abspath(DB_PATH)

db_folder = os.path.dirname(DB_PATH)
os.makedirs(db_folder, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from models.property import Property, Garage, RealAgency
    from models.person import Tenant, Owner
    from models.contract import RentalContract
    from models.contract_period import ContractPeriod
    from models.index import Index
    from models.transactions import Transaction
    from models.contract_termination import ContractTermination  # noqa: F401
    from models.contract_history import ContractHistory  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns():
    """Add new columns on existing SQLite DBs without a full migration tool."""
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    alterations = {
        "all_contracts": {
            "rental_contract_id": "INTEGER",
            "cancellation_reason": "TEXT",
            "cancelled_by": "TEXT",
            "settlement_amount": "FLOAT",
            "settlement_direction": "TEXT",
            "receipt_path": "TEXT",
        },
        "contract_periods": {
            "termination_note": "TEXT",
        },
        "contract_terminations": {
            "waive_remaining_rent": "BOOLEAN DEFAULT 0",
        },
    }

    with engine.begin() as conn:
        for table, cols in alterations.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for col, col_type in cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))

