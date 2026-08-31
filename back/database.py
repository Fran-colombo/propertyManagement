import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.base import Base


def _resolve_data_dir() -> str:
    """Docker copies back/ to /app and mounts the volume at /app/properties_data.
    Locally the SQLite file lives at repo_root/properties_data."""
    override = os.getenv("PROPERTIES_DATA_DIR", "").strip()
    if override:
        return os.path.abspath(override)
    here = os.path.dirname(os.path.abspath(__file__))
    next_to_app = os.path.join(here, "properties_data")
    repo_root = os.path.join(here, "..", "properties_data")
    if os.path.isdir(next_to_app):
        return os.path.abspath(next_to_app)
    return os.path.abspath(repo_root)


DATA_DIR = _resolve_data_dir()
DB_PATH = os.path.join(DATA_DIR, "properties.db")
UPLOADS_ROOT = os.path.join(DATA_DIR, "uploads")

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
    from models.transaction_history import TransactionHistory  # noqa: F401
    from models.contract_termination import ContractTermination  # noqa: F401
    from models.contract_history import ContractHistory  # noqa: F401
    from models.user_model import User  # noqa: F401

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
            "document_path": "TEXT",
        },
        "rental_contracts": {
            "document_path": "TEXT",
            "base_index_value": "FLOAT",
            "last_index_value": "FLOAT",
            "epe_amount": "FLOAT",
            "tgi_amount": "FLOAT",
            "api_amount": "FLOAT",
            "fire_insurance_amount": "FLOAT",
        },
        "contract_periods": {
            "termination_note": "TEXT",
            "is_prorated": "BOOLEAN DEFAULT 0",
            "proration_note": "TEXT",
        },
        "contract_terminations": {
            "waive_remaining_rent": "BOOLEAN DEFAULT 0",
        },
        "transaction_history": {
            "currency": "TEXT",
            "received_by": "TEXT DEFAULT 'DUENO'",
            "remitted_to_owner": "INTEGER DEFAULT 1",
            "remitted_at": "DATE",
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

        if "transaction_history" in inspector.get_table_names():
            conn.execute(
                text(
                    """
                    UPDATE transaction_history
                    SET currency = COALESCE((
                        SELECT rental_contracts.currency
                        FROM contract_periods
                        JOIN rental_contracts
                          ON rental_contracts.id = contract_periods.contract_id
                        WHERE contract_periods.id = transaction_history.period_id
                    ), 'PESOS')
                    WHERE currency IS NULL OR TRIM(currency) = ''
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE transaction_history
                    SET received_by = 'DUENO'
                    WHERE received_by IS NULL OR TRIM(received_by) = ''
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE transaction_history
                    SET remitted_to_owner = 1
                    WHERE remitted_to_owner IS NULL
                    """
                )
            )

