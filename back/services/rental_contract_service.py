from datetime import date
from typing import List
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models.contract_history import ContractHistory
from schemas.contract_periodDTO import ContractPeriodResponse
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

        if not contract_data.property_id and not contract_data.garage_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debés indicar una propiedad y/o un garage"
            )

        # Garage-only rental (can be linked to a property but rented separately)
        if contract_data.garage_id and not contract_data.property_id:
            return self._create_garage_only_contract(contract_data)

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
                contract.includes_garage = True
                contract.garage_id = garage.id

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

        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear el contrato: {str(e)}"
            )

    def _create_garage_only_contract(self, contract_data: CreateContractDTO) -> ContractResponse:
        garage = self.db.query(Garage).filter(Garage.id == contract_data.garage_id).first()
        if not garage:
            raise HTTPException(status_code=404, detail="Garage no encontrado")
        if garage.rental_contract is not None:
            raise HTTPException(status_code=400, detail="El garage ya está alquilado")

        try:
            contract = RentalContract(
                property_id=None,
                garage_id=garage.id,
                tenant_id=contract_data.tenant_id,
                start_date=contract_data.start_date,
                end_date=contract_data.end_date,
                currency=contract_data.currency,
                base_rent=contract_data.base_rent,
                real_agency_id=contract_data.real_agency_id,
                index_type=contract_data.index_type,
                frequency_adjustment=contract_data.frequency_adjustment,
                includes_garage=True,
                fire_insurance=contract_data.fire_insurance,
                pays_api=contract_data.pays_api,
                pays_tgi=contract_data.pays_tgi,
                pays_epe=contract_data.pays_epe,
                notes=contract_data.notes,
                status=1,
            )
            contract.garage = garage
            self.db.add(contract)
            self.db.flush()
            self._generate_contract_periods(contract)
            self.db.refresh(contract)

            address = f"Garage N° {garage.number}"
            if garage.property:
                address = f"{address} ({garage.property.direction})"

            self.db.add(ContractHistory(
                property_id=garage.property_id,
                property_address=address,
                tenant_id=contract.tenant_id,
                start_date=contract.start_date,
                end_date=contract.end_date,
            ))
            self.db.commit()
            return ContractResponse.from_orm(contract)
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear el contrato de garage: {str(e)}"
            )

    def _handle_garage_assignment(self, contract_data: dict):
        """Asigna garage al contrato de propiedad. El garage puede estar ligado a la propiedad u otro, si está libre."""
        if not contract_data.get('includes_garage'):
            return None

        garage_id = contract_data.get('garage_id')

        if garage_id:
            garage = self.db.query(Garage).filter(Garage.id == garage_id).first()
            if not garage:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El garage seleccionado no existe"
                )
            if garage.rental_contract is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El garage ya está alquilado"
                )
        else:
            property_id = contract_data.get('property_id')
            garage = self.db.query(Garage).filter(
                Garage.property_id == property_id,
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
        
        # Keep rent flat until the user applies an index adjustment per contract
        current_indexed_amount = contract.base_rent

        for month in range(total_months):
            current_end = current_start + relativedelta(months=1) - relativedelta(days=1)
            current_due = current_end

            period = ContractPeriod(
                contract_id=contract.id,
                start_date=current_start,
                end_date=current_end,
                due_date=current_due,
                base_rent=contract.base_rent,
                indexed_amount=current_indexed_amount,
                total_amount=current_indexed_amount,
                index_id=None,
                applied_index_value=None,
                payment_status=PaymentStatusEnum.PENDIENTE
            )
            periods.append(period)

            current_start = current_end + relativedelta(days=1)

        self.db.add_all(periods)
        self.db.commit()
        return periods

    def _should_apply_index(self, period_start: date, contract_start: date, freq_enum: AdjustmentFrequencyEnum):
        months_elapsed = (period_start.year - contract_start.year) * 12 + (period_start.month - contract_start.month)
        if months_elapsed <= 0:
            return False
        
        if freq_enum == AdjustmentFrequencyEnum.TRIMESTRAL:
            return months_elapsed % 3 == 0
        elif freq_enum == AdjustmentFrequencyEnum.CUATRIMESTRAL:
            return months_elapsed % 4 == 0
        else:
            return False

    def apply_index(self, contract_id: int, value: float) -> ContractResponse:
        """Apply a percentage index update to a single contract, forward-only."""
        contract = self.get_contract(contract_id)

        if contract.currency == CurrencyEnum.DOLARES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los contratos en dólares no usan indexación"
            )
        if not contract.index_type or not contract.frequency_adjustment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El contrato no tiene tipo de índice o frecuencia de ajuste"
            )
        if value is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debés indicar el porcentaje de variación"
            )

        def status_value(period):
            s = period.payment_status
            return s.value if hasattr(s, "value") else s

        def is_locked(period):
            return status_value(period) in (
                PaymentStatusEnum.PAGADO.value,
                PaymentStatusEnum.CONTRATO_TERMINADO.value,
            )

        periods = sorted(contract.periods, key=lambda p: p.start_date)
        if not periods:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El contrato no tiene períodos"
            )

        adjustment_period = None
        for period in periods:
            if is_locked(period):
                continue
            if not self._should_apply_index(
                period.start_date,
                contract.start_date,
                contract.frequency_adjustment
            ):
                continue
            if period.applied_index_value is not None:
                continue
            adjustment_period = period
            break

        # Legacy contracts may have speculative applied_index_value on several
        # future checkpoints from old create logic. Allow one forward apply.
        if not adjustment_period:
            candidates = [
                p for p in periods
                if not is_locked(p)
                and self._should_apply_index(
                    p.start_date,
                    contract.start_date,
                    contract.frequency_adjustment,
                )
            ]
            with_values = [p for p in candidates if p.applied_index_value is not None]
            if len(with_values) > 1:
                adjustment_period = candidates[0]

        if not adjustment_period:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay un período de ajuste pendiente para este contrato"
            )

        adjustment_date = adjustment_period.start_date

        prior_periods = [p for p in periods if p.start_date < adjustment_date]
        if prior_periods:
            base_amount = prior_periods[-1].indexed_amount or contract.base_rent
        else:
            base_amount = contract.base_rent

        new_amount = round(base_amount * (1 + value / 100), 2)

        for period in periods:
            if period.start_date < adjustment_date:
                continue
            if is_locked(period):
                continue

            period.indexed_amount = new_amount
            tax_total = sum(
                amount or 0
                for amount in [
                    period.epe_amount,
                    period.tgi_amount,
                    period.api_amount,
                    period.fire_proof_amount,
                ]
            )
            period.total_amount = new_amount + tax_total

            if period.id == adjustment_period.id:
                period.applied_index_value = value
                period.index_type = contract.index_type
            elif period.applied_index_value is not None and self._should_apply_index(
                period.start_date,
                contract.start_date,
                contract.frequency_adjustment,
            ):
                # Clear speculative future applications so the next real apply works
                period.applied_index_value = None
                period.index_id = None

        self.db.commit()
        self.db.refresh(contract)
        return ContractResponse.from_orm(contract)

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
        return [ContractResponse.from_orm(c) for c in contracts]
    

    
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
