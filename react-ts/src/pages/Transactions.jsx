import { useEffect, useState } from "react";
import { Card, Table, Badge, Form, InputGroup, Row, Col, Container, Spinner } from "react-bootstrap";
import { Calendar, Cash, Search, Funnel, CreditCard, FileText } from "react-bootstrap-icons";
import { getAllTransactions } from "../api/transaction";


const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
});

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await getAllTransactions();
        setTransactions(data);
      } catch (error) {
        console.error("Error al cargar transacciones", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
const search = searchTerm.toLowerCase();

const matchesSearch =
  transaction.contract?.tenant?.name?.toLowerCase().includes(search) ||
  transaction.contract?.owner?.name?.toLowerCase().includes(search) ||
  transaction.contract?.property_direction?.toLowerCase().includes(search) ||
  transaction.notes?.toLowerCase().includes(search);


    const matchesDate = !dateFilter || transaction.date.includes(dateFilter);
    const matchesMethod = !methodFilter || transaction.method === methodFilter;

    return matchesSearch && matchesDate && matchesMethod;
  });

  const totalAmount = filteredTransactions.reduce(
    (sum, transaction) => sum + transaction.amount, 0
  );

  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case "efectivo":
        return <Cash className="me-1" />;
      case "transferencia":
        return <CreditCard className="me-1" />;
      default:
        return <FileText className="me-1" />;
    }
  };

  const getPaymentMethodBadge = (method) => {
    switch (method?.toLowerCase()) {
      case "efectivo":
        return <Badge bg="success" className="d-flex align-items-center">{getPaymentMethodIcon(method)}{method}</Badge>;
      case "transferencia":
        return <Badge bg="primary" className="d-flex align-items-center">{getPaymentMethodIcon(method)}{method}</Badge>;
      default:
        return <Badge bg="secondary" className="d-flex align-items-center">{getPaymentMethodIcon(method)}{method || "Otro"}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "completado":
        return <Badge bg="success">{status}</Badge>;
      case "pendiente":
        return <Badge bg="warning" text="dark">{status}</Badge>;
      case "cancelado":
        return <Badge bg="danger">{status}</Badge>;
      default:
        return <Badge bg="secondary">{status || "N/A"}</Badge>;
    }
  };

  if (loading) return <Spinner animation="border" className="m-5" />;

  return (
    

    <Container className="py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="h2 mb-0">Transacciones</h1>
        </Col>
        <Col xs="auto">
          <div className="d-flex align-items-center text-muted">
            <Calendar className="me-2" />
            <span>{new Date().toLocaleDateString("es-AR")}</span>
          </div>
        </Col>
      </Row>
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={4}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Total de Transacciones</p>
                <h3 className="mb-0">{filteredTransactions.length}</h3>
              </div>
            </Col>
            <Col md={4}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Monto Total</p>
                <h3 className="mb-0 text-success">${totalAmount.toLocaleString()}</h3>
              </div>
            </Col>
            <Col md={4} className="d-flex justify-content-end">
              <div className="bg-primary bg-opacity-10 p-3 rounded">
                <Cash size={24} className="text-primary" />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Buscar por inquilino, dueño o notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <Calendar />
                </InputGroup.Text>
                <Form.Control
                  type="month"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <Funnel />
                </InputGroup.Text>
                <Form.Select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                >
                  <option value="">Todos los métodos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                </Form.Select>
              </InputGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header className="bg-white">
          <h5 className="mb-0">Historial de Transacciones</h5>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table striped hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Dirección</th>
                  <th>Dueño</th>
                  <th>Inquilino</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Notas</th>
                  <th>Estado</th>
                  <th>Total del Período</th>
                  <th>Pagado</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.date).toLocaleDateString("es-AR")}</td>
                    <td>{transaction.contract?.property_direction}</td>
                    <td>{transaction.contract?.owner?.name || "N/A"}</td>
                    <td>{transaction.contract?.tenant?.name || "N/A"}</td>
                    <td>${transaction.amount.toLocaleString()}</td>
                    <td>{getPaymentMethodBadge(transaction.method)}</td>
                    <td>{transaction.notes || "-"}</td>
                    <td>{getStatusBadge(transaction.period?.payment_status)}</td>
                    <td>${transaction.period?.total_amount?.toLocaleString() || "-"}</td>
                    <td>${transaction.period?.amount_paid?.toLocaleString() || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Container>
        
  );
};

export default Transactions;