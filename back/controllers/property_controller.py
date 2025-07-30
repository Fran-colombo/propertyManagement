from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas.propertyDTO import CreatePropertyDTO, PropertyResponse
from services.property_service import PropertyService

router = APIRouter(prefix="/properties", tags=["Properties"])

def get_service(db: Session = Depends(get_db)):
    return PropertyService(db)

@router.post("", response_model=PropertyResponse, status_code=201)
def create_property(
    property_data: CreatePropertyDTO,
    service: PropertyService = Depends(get_service)
):
    return service.create_property(property_data)

@router.get("/", response_model=List[PropertyResponse])
def get_properties(
    service: PropertyService = Depends(get_service),
    db: Session = Depends(get_db)
):
    from services.rental_contract_service import RentalContractService
    RentalContractService(db).release_properties_from_ended_contracts()
    
    return service.get_properties()

@router.get("/{prop_id}", response_model=PropertyResponse)
def get_property_by_id(
    prop_id: int, 
    service: PropertyService = Depends(get_service)
):
    return service.get_property_by_id(prop_id)

@router.delete("/{property_id}")
def delete_property(
    property_id: int, 
    service: PropertyService = Depends(get_service)
):
    try:
        return service.delete_property(property_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al eliminar la propiedad: {str(e)}"
        )