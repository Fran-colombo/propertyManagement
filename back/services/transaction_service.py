from datetime import date
from models.transaction_history import TransactionHistory
from models.transactions import Transaction
from repositories.transaction_repository import TransactionRepository
from schemas.transactionDTO import TransactionHistoryResponse, TransactionResponseDTO, SimpleUser, ContractInfo, PeriodInfo
from sqlalchemy.orm import Session

class TransactionService:
    def __init__(self, db: Session):
        self.db = db


    def get_all_history(self) -> list[TransactionHistoryResponse]:
        """Obtiene todas las transacciones del historial"""
        history_records = self.db.query(TransactionHistory).order_by(TransactionHistory.date.desc()).all()
        return [self._history_to_dto(record) for record in history_records]

    def get_history_by_period(self, period_id: int) -> list[TransactionHistoryResponse]:
        """Obtiene transacciones del historial por período"""
        history_records = self.db.query(TransactionHistory).filter(
            TransactionHistory.period_id == period_id
        ).order_by(TransactionHistory.date.desc()).all()
        return [self._history_to_dto(record) for record in history_records]

    def _history_to_dto(self, record: TransactionHistory) -> TransactionHistoryResponse:
        """Convierte un registro de historial a DTO"""
        return TransactionHistoryResponse(
            id=record.transaction_id,
            amount=record.amount,
            date=record.date,
            method=record.method,
            notes=record.notes,
            contract=ContractInfo(
                id=record.contract_id,
                owner=SimpleUser(id=record.owner_id, name=record.owner_name),
                tenant=SimpleUser(id=record.tenant_id, name=record.tenant_name),
                property_direction=record.property_direction
            ),
            period=PeriodInfo(
                id=record.period_id,
                start_date=record.period_start_date,
                end_date=record.period_end_date,
                due_date=record.period_due_date,
                total_amount=record.period_total_amount,
                payment_status=record.period_payment_status,
                amount_paid=record.period_amount_paid,  
                remaining_amount=record.period_total_amount - record.period_amount_paid
            )
        )

    def get_all(self) -> list[TransactionResponseDTO]:
        """Obtiene todas las transacciones (método original)"""
        txs = self.db.query(Transaction).all()
        return [self._to_dto(tx) for tx in txs]

    def get_by_period(self, period_id: int) -> list[TransactionResponseDTO]:
        """Obtiene transacciones por período (método original)"""
        txs = self.db.query(Transaction).filter(
            Transaction.period_id == period_id
        ).all()
        return [self._to_dto(tx) for tx in txs]
    
    def _to_dto(self, tx: Transaction) -> TransactionResponseDTO:
    # Initialize default values
        default_contract = ContractInfo(
            id=0,
            owner=SimpleUser(id=0, name="Unknown Owner"),
            tenant=SimpleUser(id=0, name="Unknown Tenant"),
            property_direction="Unknown Property"
        )

        try:
            contract = tx.period.contract if hasattr(tx, 'period') and tx.period else None
            
            if contract:
                # Try to get owner info
                owner = SimpleUser(id=0, name="Unknown Owner")
                if hasattr(contract, 'property') and contract.property and hasattr(contract.property, 'owner'):
                    if contract.property.owner:
                        owner = SimpleUser(
                            id=contract.property.owner.id,
                            name=contract.property.owner.name
                        )

                # Try to get tenant info
                tenant = SimpleUser(id=0, name="Unknown Tenant")
                if hasattr(contract, 'tenant') and contract.tenant:
                    tenant = SimpleUser(
                        id=contract.tenant.id,
                        name=contract.tenant.name
                    )

                # Try to get property direction
                property_direction = "Unknown Property"
                if hasattr(contract, 'property') and contract.property and hasattr(contract.property, 'direction'):
                    property_direction = contract.property.direction

                contract_info = ContractInfo(
                    id=contract.id,
                    owner=owner,
                    tenant=tenant,
                    property_direction=property_direction
                )
            else:
                contract_info = default_contract

            # Handle period info
            period_info = PeriodInfo(
                id=tx.period.id if hasattr(tx, 'period') and tx.period else 0,
                start_date=tx.period.start_date if hasattr(tx, 'period') and tx.period else date.today(),
                end_date=tx.period.end_date if hasattr(tx, 'period') and tx.period else date.today(),
                due_date=tx.period.due_date if hasattr(tx, 'period') and tx.period else date.today(),
                payment_status=tx.period.payment_status if hasattr(tx, 'period') and tx.period else "UNKNOWN",
                total_amount=tx.period.total_amount if hasattr(tx, 'period') and tx.period else 0,
                amount_paid=tx.period.amount_paid if hasattr(tx, 'period') and tx.period else 0,
                remaining_amount=(tx.period.total_amount - tx.period.amount_paid) if hasattr(tx, 'period') and tx.period else 0
            )

            return TransactionResponseDTO(
                id=tx.id,
                amount=tx.amount,
                date=tx.date,
                method=tx.method,
                notes=tx.notes,
                remaining_amount=tx.remaining_amount,
                contract=contract_info,
                period=period_info
            )

        except Exception as e:
            # Fallback to default values if anything goes wrong
            return TransactionResponseDTO(
                id=tx.id,
                amount=tx.amount,
                date=tx.date,
                method=tx.method,
                notes=tx.notes,
                remaining_amount=tx.remaining_amount,
                contract=default_contract,
                period=PeriodInfo(
                    id=0,
                    start_date=date.today(),
                    end_date=date.today(),
                    due_date=date.today(),
                    payment_status="UNKNOWN",
                    total_amount=0,
                    amount_paid=0,
                    remaining_amount=0
                )
            )
        
    