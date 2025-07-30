from sched import scheduler
from fastapi import FastAPI
from services.rental_contract_service import RentalContractService
from controllers import tenant_controller, user_controller, owner_controller, property_controller, rental_contract_controller, contract_period_controller, transaction_controller, garage_controller, real_agency_controller, index_controller, contract_history_controller
from database import Base, SessionLocal, engine
from database import init_db
from scheduler_tasks import init_scheduler
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

init_db()

app = FastAPI()
scheduler = BackgroundScheduler() 


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


app.include_router(user_controller.router)
app.include_router(tenant_controller.router)
app.include_router(owner_controller.router)
app.include_router(property_controller.router)
app.include_router(rental_contract_controller.router)
app.include_router(contract_period_controller.router)
app.include_router(transaction_controller.router)
app.include_router(garage_controller.router)
app.include_router(real_agency_controller.router)
app.include_router(index_controller.router)
app.include_router(contract_history_controller.router)




@app.on_event("startup")
def startup_event():
    init_scheduler()
    db = SessionLocal()
    service = RentalContractService(db)  
    
    scheduler.add_job(
        service.release_properties_from_ended_contracts,
        'interval',
        hours=24
    )
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()