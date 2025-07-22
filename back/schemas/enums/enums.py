import enum

class IndexTypeEnum(str, enum.Enum):
    IPC = "IPC"
    ICL = "ICL"

class CurrencyEnum(str, enum.Enum):
    PESOS = "PESOS"
    DOLARES = "DOLARES"


class AdjustmentFrequencyEnum(str, enum.Enum):
    TRIMESTRAL = "TRIMESTRAL"
    CUATRIMESTRAL = "CUATRIMESTRAL"

class PaymentStatusEnum(str, enum.Enum):
    PAGADO = "PAGADO"
    PARCIAL = "PARCIAL"
    PENDIENTE = "PENDIENTE"
    VENCIDO = "VENCIDO"
    POR_VENCER = "POR_VENCER"
    CONTRATO_TERMINADO = "CONTRATO_TERMINADO"