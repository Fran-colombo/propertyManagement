import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Card } from "react-bootstrap"
import { PeopleFill, HouseDoorFill, ReceiptCutoff, FileEarmarkTextFill, ClockHistory, CashStack } from "react-bootstrap-icons"
import { getSalesSummary } from "../api/sale"

export default function Dashboard() {
  const navigate = useNavigate()
  const [pendingInstallments, setPendingInstallments] = useState(0)

  useEffect(() => {
    getSalesSummary()
      .then((data) => setPendingInstallments(data?.pending_installments || 0))
      .catch(() => setPendingInstallments(0))
  }, [])

  return (
    <div className="d-flex justify-content-center py-3">
      <Card className="shadow-lg p-3 p-md-4 w-100" style={{ maxWidth: "500px" }}>
        <Card.Body>
          <Card.Title className="text-center mb-4 fs-3">Sistema de Gestión Inmobiliaria</Card.Title>
          <div className="d-grid gap-3">
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => navigate("/people")}
            >
              <PeopleFill className="me-2" /> Personas
            </Button>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => navigate("/properties")}
            >
              <HouseDoorFill className="me-2" /> Propiedades y cocheras
            </Button>
            <Button 
              variant={pendingInstallments > 0 ? "warning" : "primary"} 
              size="lg"
              onClick={() => navigate("/sales")}
            >
              <CashStack className="me-2" /> Ventas
              {pendingInstallments > 0 ? ` · ${pendingInstallments} por cobrar` : ""}
            </Button>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => navigate("/transactions")}
            >
              <ReceiptCutoff className="me-2" /> Transacciones
            </Button>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => navigate("/contracts")}
            >
              <FileEarmarkTextFill className="me-2" /> Contratos activos
            </Button>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => navigate("/all-contracts")}
            >
              <ClockHistory className="me-2" /> Historial de contratos
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}
