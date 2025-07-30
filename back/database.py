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

    Base.metadata.create_all(bind=engine)

