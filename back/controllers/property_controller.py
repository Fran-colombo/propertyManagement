# from typing import List
# from fastapi import APIRouter, Depends
# # from sqlalchemy.orm import Session
# from repositories.property_repository import PropertyRepository
# from services.rental_contract_service import RentalContractService
# from schemas.propertyDTO import CreatePropertyDTO, PropertyResponse
# from services.property_service import PropertyService
# from database import get_db
# from sqlalchemy.orm import Session
# from dependencies import get_property_service  

# router = APIRouter(prefix="/properties", tags=["Properties"])

# def get_service(db: Session = Depends(get_db)):
#     repo = PropertyRepository(db)
#     return PropertyService(repo)

# @router.post("", response_model=PropertyResponse, status_code=201)
# def create_property(
#     property_data: CreatePropertyDTO,
#     service: PropertyService = Depends(get_property_service)
# ):
#     return service.create_property(property_data)


# @router.get("/", response_model=List[PropertyResponse])
# def get_properties(service: PropertyService = Depends(get_property_service), db: Session = Depends(get_db)):
#     contractService = RentalContractService(db)
#     contractService.release_properties_from_ended_contracts()
#     return service.get_properties()

# @router.get("/{prop_id}")
# def get_property_by_id(prop_id: int, db: Session = Depends(get_db)):
#     service = PropertyService(db)
#     prop = service.get_property_by_id(prop_id, db)
#     return prop

# # @router.put("/{owner_id}")
# # def update_owner(owner_id: int, data: UpdatePropertyDTO, db: Session = Depends(get_db)):
# #     return PropertyService(db).update_property(owner_id, data)

# @router.delete("/{property_id}")
# def delete_property(property_id: int, service: PropertyService = Depends(get_service)):
#     return service.delete_property(property_id)
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