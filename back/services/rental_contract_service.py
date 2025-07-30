from datetime import date
from typing import List
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models.contract_history import ContractHistory
from schemas.contract_periodDTO import ContractPeriodResponse
from services.index_service import IndexService
from models.contract import RentalContract
from models.contract_period import ContractPeriod
from models.property import Garage, Property
from schemas.contractDTO import ContractResponse, CreateContractDTO
from schemas.enums.enums import AdjustmentFrequencyEnum, PaymentStatusEnum, CurrencyEnum

class RentalContractService:
    def __init__(self, db: Session):
        self.db = db




    def create_contract(self, contract_data: CreateContractDTO) -> ContractResponse:
        if contract_data.end_date <= contract_data.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha de fin debe ser posterior a la de inicio"
            )
        
        existing = self.db.query(RentalContract).filter(
            RentalContract.property_id == contract_data.property_id,
            RentalContract.status == 1
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="La propiedad ya está alquilada")

        try:
            contract_dict = contract_data.dict(exclude_unset=True)
            garage = self._handle_garage_assignment(contract_dict)

            property_obj = self.db.query(Property).filter_by(id=contract_dict["property_id"]).first()
            if not property_obj:
                raise HTTPException(status_code=404, detail="Propiedad no encontrada")

            contract = RentalContract(**contract_dict)
            contract.property = property_obj  

            if garage:
                contract.garage = garage

            if garage:
                contract.garage = garage
            
            self.db.add(contract)
            self.db.flush() 
            
            self._generate_contract_periods(contract)
            
            self.db.refresh(contract)
            all_contract = ContractHistory(
                property_id=contract.property_id,
                property_address=property_obj.direction,
                tenant_id=contract.tenant_id,
                start_date=contract.start_date,
                end_date=contract.end_date
            )

            self.db.add(all_contract)
            self.db.commit()
            
            return ContractResponse.from_orm(contract)
            
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear el contrato: {str(e)}"
            )
    def _handle_garage_assignment(self, contract_data: dict):
        """Maneja la lógica de asignación de garage"""
        if not contract_data.get('includes_garage'):
            return None
            
        garage_id = contract_data.get('garage_id')
        
        if garage_id:
            garage = self.db.query(Garage).filter(
                Garage.id == garage_id,
                Garage.rental_contract == None
            ).first()
            
            if not garage:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El garage seleccionado no existe o ya está asignado"
                )
        else:
            garage = self.db.query(Garage).filter(
                Garage.property_id == contract_data['property_id'],
                Garage.rental_contract == None
            ).first()
            
            if not garage:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No hay garages disponibles para esta propiedad"
                )
        
        return garage

    def _generate_contract_periods(self, contract):
        periods = []
        current_start = contract.start_date
        total_months = (contract.end_date.year - contract.start_date.year) * 12 + (contract.end_date.month - contract.start_date.month)
        
        current_indexed_amount = contract.base_rent
        first_period = True
        apply_indexation = contract.currency != CurrencyEnum.DOLARES

        for month in range(total_months):
            current_end = current_start + relativedelta(months=1) - relativedelta(days=1)
            current_due = current_end

            apply_index = False
            if not first_period and apply_indexation:
                apply_index = self._should_apply_index(
                    current_start,
                    contract.start_date,
                    contract.frequency_adjustment
                )

            if apply_index and contract.index_type:
                index = IndexService.get_applicable_index(
                    self.db,
                    contract.index_type.value,
                    current_start
                )
                if index:
                    current_indexed_amount = round(current_indexed_amount * (1 + index.value / 100), 2)
                    applied_index_id = index.id
                    applied_index_value = index.value
                else:
                    applied_index_id = None
                    applied_index_value = None
            else:
                applied_index_id = None
                applied_index_value = None

            period = ContractPeriod(
                contract_id=contract.id,
                start_date=current_start,
                end_date=current_end,
                due_date=current_due,
                base_rent=contract.base_rent,  
                indexed_amount=current_indexed_amount,  
                total_amount=current_indexed_amount,  
                index_id=applied_index_id,
                applied_index_value=applied_index_value,
                payment_status=PaymentStatusEnum.PENDIENTE
            )
            periods.append(period)

            first_period = False
            current_start = current_end + relativedelta(days=1)

        self.db.add_all(periods)
        self.db.commit()
        return periods



    def _should_apply_index(self, period_start: date, contract_start: date, freq_enum: AdjustmentFrequencyEnum):

        months_elapsed = (period_start.year - contract_start.year) * 12 + (period_start.month - contract_start.month)
        
        if freq_enum == AdjustmentFrequencyEnum.TRIMESTRAL:
            return months_elapsed % 3 == 0
        elif freq_enum == AdjustmentFrequencyEnum.CUATRIMESTRAL:
            return months_elapsed % 4 == 0
        else:
            return False

    def get_contract(self, contract_id: int) -> RentalContract:
        contract = self.db.query(RentalContract).filter_by(id=contract_id).first()
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contrato no encontrado"
            )
        return contract
    
    def get_all_contracts(self) -> List[ContractResponse]:
        contracts = self.db.query(RentalContract).all()
        if not contracts:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontraron contratos"
            )
        return  [ContractResponse.from_orm(c) for c in contracts]
    

    
    def get_pending_contracts(self) -> List[ContractResponse]:
        """Obtiene todos los contratos con periodos pendientes de pago"""
        today = date.today()
        contracts = self.db.query(RentalContract)\
            .join(ContractPeriod)\
            .filter(
                ContractPeriod.payment_status != 'PAGADO',
                RentalContract.start_date <= today,
                RentalContract.end_date >= today
            )\
            .distinct()\
            .all()

        return [ContractResponse.from_orm(c) for c in contracts]


    def get_overdue_periods(self, contract_id: int) -> List[ContractPeriodResponse]:
        today = date.today()
        periods = self.db.query(ContractPeriod)\
            .filter(
                ContractPeriod.contract_id == contract_id,
                ContractPeriod.due_date < today,
                ContractPeriod.payment_status != 'PAGADO'
            ).all()

        return [ContractPeriodResponse.from_orm(p) for p in periods]
    

    def release_properties_from_ended_contracts(self):
        today = date.today()

        contracts = self.db.query(RentalContract)\
            .join(ContractPeriod)\
            .filter(
                RentalContract.end_date < today,
                RentalContract.status == 1
            )\
            .all()

        for contract in contracts:
            has_pending_debt = any(
                p.payment_status in [
                    PaymentStatusEnum.PENDIENTE,
                    PaymentStatusEnum.VENCIDO,
                    PaymentStatusEnum.POR_VENCER,
                    PaymentStatusEnum.PARCIAL
                ] for p in contract.periods
            )

            if not has_pending_debt:
                contract.status = 0

        self.db.commit()


    def cancel_contract(self, contract_id: int):
        today = date.today()
        contract = self.get_contract(contract_id)

        if contract.status == 0:
            raise HTTPException(status_code=400, detail="El contrato ya está cancelado")

        try:
            contract.status = 0
            contract.end_date = today  
            all_contract = self.db.query(ContractHistory).filter(ContractHistory.id == contract.id).first()
            if all_contract:
                all_contract.end_date = contract.end_date
                all_contract.cancelled = 1

            future_periods = self.db.query(ContractPeriod)\
                .filter(
                    ContractPeriod.contract_id == contract_id,
                    ContractPeriod.start_date > today,
                    ContractPeriod.payment_status != PaymentStatusEnum.PAGADO
                )\
                .all()

            for period in future_periods:
                period.payment_status = PaymentStatusEnum.CONTRATO_TERMINADO
                period.end_date = today  
                period.due_date = today  

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Error al cancelar el contrato: {str(e)}")
