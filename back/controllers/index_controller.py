from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.updateIndexDTO import CreateIndex, UpdateIndexDTO
from services.index_service import IndexService

router = APIRouter(prefix="/indices", tags=["Indices"])

@router.post("/", status_code=201)
def create_index(dto: CreateIndex, db: Session = Depends(get_db)):
    try:
        return IndexService.create(db, dto)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/", status_code=200)
def update_index(dto: UpdateIndexDTO, db: Session = Depends(get_db)):
    try:
        return IndexService.update(db, dto)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.get("/")
def get_indexes(db:Session = Depends(get_db)):
    return IndexService.get_indexes(db)