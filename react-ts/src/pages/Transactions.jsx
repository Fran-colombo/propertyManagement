import { useEffect, useState } from "react";
import { Card, Table, Badge, Form, InputGroup, Row, Col, Spinner, Alert, Button } from "react-bootstrap";
import { Calendar, Cash, Search, Funnel, CreditCard, FileText } from "react-bootstrap-icons";
import { getAllTransactions, registerCreditNote } from "../api/transaction";
import CreditNoteModal from "../components/CreditNoteModal";
import FeedbackModal from "../components/FeedbackModal";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value, delta) {
  const [y, m] = (value || currentMonthValue()).split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState(currentMonthValue);
  const [creditTx, setCreditTx] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await getAllTransactions();
      setTransactions(data || []);
    } catch (err) {
      console.error("Error al cargar transacciones", err);
      setError(err.message || "No se pudieron cargar las transacciones");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      transaction.contract?.tenant?.name?.toLowerCase().includes(search) ||
      transaction.contract?.owner?.name?.toLowerCase().includes(search) ||
      transaction.contract?.property_direction?.toLowerCase().includes(search) ||
      transaction.notes?.toLowerCase().includes(search);

    const matchesDate =
      !dateFilter || String(transaction.date || "").includes(dateFilter);
    const matchesMethod =
      !methodFilter ||
      String(transaction.method || "").toLowerCase() === methodFilter;

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
      case "nota_credito":
        return <Badge bg="danger" className="d-flex align-items-center">{getPaymentMethodIcon(method)}Nota de crédito</Badge>;
      default:
        return <Badge bg="secondary" className="d-flex align-items-center">{getPaymentMethodIcon(method)}{method || "Otro"}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "pagado":
      case "completado":
        return <Badge bg="success">{status}</Badge>;
      case "parcial":
      case "pendiente":
        return <Badge bg="warning" text="dark">{status}</Badge>;
      case "cancelado":
      case "contrato_terminado":
        return <Badge bg="danger">{status}</Badge>;
      default:
        return <Badge bg="secondary">{status || "N/A"}</Badge>;
    }
  };

  const renderNotes = (notes, method) => {
    const text = notes || "";
    const isAdvance = /adelanto/i.test(text);
    const isCredit = method === "nota_credito" || /nota de crédito/i.test(text);
    return (
      <div className="text-break" style={{ maxWidth: 280 }}>
        {isAdvance && <Badge bg="info" className="me-1">Adelanto</Badge>}
        {isCredit && <Badge bg="danger" className="me-1">Crédito</Badge>}
        <span>{text || "—"}</span>
      </div>
    );
  };

  const handleCredit = async (periodId, data) => {
    try {
      await registerCreditNote(periodId, data);
      setCreditTx(null);
      await loadTransactions();
      setFeedback({
        variant: "success",
        title: "Nota de crédito",
        message: "La nota de crédito se registró correctamente.",
      });
    } catch (err) {
      setCreditTx(null);
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "No se pudo registrar la nota de crédito",
      });
    }
  };

  if (loading) return <Spinner animation="border" className="m-5" />;

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
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
            <Col xs={12} md={4}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Total de Transacciones</p>
                <h3 className="mb-0">{filteredTransactions.length}</h3>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Monto Total</p>
                <h3 className={`mb-0 ${totalAmount < 0 ? "text-danger" : "text-success"}`}>
                  ${totalAmount.toLocaleString()}
                </h3>
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
            <Col xs={12} md={4}>
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
            <Col xs={12} md={4}>
              <InputGroup>
                <Button
                  variant="outline-secondary"
                  onClick={() => setDateFilter((v) => shiftMonth(v || currentMonthValue(), -1))}
                >
                  ‹
                </Button>
                <InputGroup.Text>
                  <Calendar />
                </InputGroup.Text>
                <Form.Control
                  type="month"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setDateFilter((v) => shiftMonth(v || currentMonthValue(), 1))}
                >
                  ›
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                Mes actual por defecto. Vacío lista todas.
              </Form.Text>
              {dateFilter && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-2"
                  onClick={() => setDateFilter("")}
                >
                  Ver todas
                </Button>
              )}
            </Col>
            <Col xs={12} md={4}>
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
                  <option value="nota_credito">Nota de crédito</option>
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
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.date).toLocaleDateString("es-AR")}</td>
                    <td>{transaction.contract?.property_direction}</td>
                    <td>{transaction.contract?.owner?.name || "N/A"}</td>
                    <td>{transaction.contract?.tenant?.name || "N/A"}</td>
                    <td className={transaction.amount < 0 ? "text-danger" : ""}>
                      ${transaction.amount.toLocaleString()}
                    </td>
                    <td>{getPaymentMethodBadge(transaction.method)}</td>
                    <td>{renderNotes(transaction.notes, transaction.method)}</td>
                    <td>{getStatusBadge(transaction.period?.payment_status)}</td>
                    <td>${transaction.period?.total_amount?.toLocaleString() || "-"}</td>
                    <td>${transaction.period?.amount_paid?.toLocaleString() || "-"}</td>
                    <td>
                      {transaction.amount > 0 && transaction.period?.id && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => setCreditTx(transaction)}
                        >
                          Nota de crédito
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
      <CreditNoteModal
        show={!!creditTx}
        transaction={creditTx}
        onHide={() => setCreditTx(null)}
        onSave={handleCredit}
      />
      <FeedbackModal
        show={!!feedback}
        variant={feedback?.variant}
        title={feedback?.title}
        message={feedback?.message}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
};

export default Transactions;
