import { useNavigate } from "react-router-dom"
import { Button, Card, Container, Row, Col } from "react-bootstrap"
import { PeopleFill, HouseDoorFill, ReceiptCutoff, FileEarmarkTextFill, ClockHistory } from "react-bootstrap-icons"

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Card className="shadow-lg p-4" style={{ minWidth: "400px", maxWidth: "500px", width: "100%" }}>
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
    </Container>
  )
}
