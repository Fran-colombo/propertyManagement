import { useEffect, useState } from "react";
import { Card, Table, Badge, Form, InputGroup, Row, Col, Spinner, Alert, Button, Pagination } from "react-bootstrap";
import { Calendar, Cash, Search, Funnel, CreditCard, FileText } from "react-bootstrap-icons";
import { getAllTransactions, registerCreditNote, remitToOwner } from "../api/transaction";
import CreditNoteModal from "../components/CreditNoteModal";
import FeedbackModal from "../components/FeedbackModal";

const PAGE_SIZE = 20;

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value, delta) {
  const [y, m] = (value || currentMonthValue()).split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isDollars(currency) {
  const value = String(currency || "PESOS").toUpperCase();
  return value === "DOLARES" || value === "USD" || value === "DOLAR";
}

function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  const prefix = isDollars(currency) ? "U$S" : "$";
  return `${prefix} ${n.toLocaleString("es-AR")}`;
}

function isIntermediary(transaction) {
  return String(transaction?.received_by || "").toUpperCase() === "INTERMEDIARIO";
}

function isPendingRemit(transaction) {
  return (
    isIntermediary(transaction) &&
    transaction?.remitted_to_owner === false &&
    Number(transaction?.amount) > 0
  );
}

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [remittanceFilter, setRemittanceFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState(currentMonthValue);
  const [creditTx, setCreditTx] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [totalPesos, setTotalPesos] = useState(0);
  const [totalDolares, setTotalDolares] = useState(0);
  const [pendingPesos, setPendingPesos] = useState(0);
  const [pendingDolares, setPendingDolares] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFilter, methodFilter, remittanceFilter]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAllTransactions({
        page,
        pageSize: PAGE_SIZE,
        q: debouncedSearch || undefined,
        month: dateFilter || undefined,
        method: methodFilter || undefined,
        remittance: remittanceFilter || undefined,
      });
      setTransactions(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 0);
      setTotalPesos(data?.total_pesos || 0);
      setTotalDolares(data?.total_dolares || 0);
      setPendingPesos(data?.pending_pesos || 0);
      setPendingDolares(data?.pending_dolares || 0);
    } catch (err) {
      console.error("Error al cargar transacciones", err);
      setError(err.message || "No se pudieron cargar las transacciones");
      setTransactions([]);
      setTotal(0);
      setPages(0);
      setTotalPesos(0);
      setTotalDolares(0);
      setPendingPesos(0);
      setPendingDolares(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [page, debouncedSearch, dateFilter, methodFilter, remittanceFilter]);

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

  const handleRemit = async (transaction) => {
    try {
      await remitToOwner(transaction.history_id);
      await loadTransactions();
      setFeedback({
        variant: "success",
        title: "Rendido al dueño",
        message: "Marcaste que ya le pasaste esa plata al dueño.",
      });
    } catch (err) {
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "No se pudo marcar la rendición",
      });
    }
  };

  const pageItems = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(pages, windowStart + 4);
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pageItems.push(p);
  }

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
            <Col xs={12} md={2}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Total de Transacciones</p>
                <h3 className="mb-0">{total}</h3>
              </div>
            </Col>
            <Col xs={6} md={2}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Total pesos</p>
                <h3 className={`mb-0 ${totalPesos < 0 ? "text-danger" : "text-success"}`}>
                  {formatMoney(totalPesos, "PESOS")}
                </h3>
              </div>
            </Col>
            <Col xs={6} md={2}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Total dólares</p>
                <h3 className={`mb-0 ${totalDolares < 0 ? "text-danger" : "text-success"}`}>
                  {formatMoney(totalDolares, "DOLARES")}
                </h3>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Por rendir al dueño (pesos)</p>
                <h3 className={`mb-0 ${pendingPesos ? "text-warning" : "text-muted"}`}>
                  {formatMoney(pendingPesos, "PESOS")}
                </h3>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="mb-3 mb-md-0">
                <p className="text-muted mb-1">Por rendir al dueño (dólares)</p>
                <h3 className={`mb-0 ${pendingDolares ? "text-warning" : "text-muted"}`}>
                  {formatMoney(pendingDolares, "DOLARES")}
                </h3>
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
            <Col xs={12} md={3}>
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
            <Col xs={12} md={3}>
              <Form.Select
                value={remittanceFilter}
                onChange={(e) => setRemittanceFilter(e.target.value)}
                aria-label="Filtrar rendición"
              >
                <option value="">Toda la rendición</option>
                <option value="pending">Por rendir al dueño</option>
                <option value="remitted">Ya rendidas</option>
                <option value="owner">Pagó directo al dueño</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header className="bg-white">
          <h5 className="mb-0">Historial de Transacciones</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" />
            </div>
          ) : (
            <div className="table-responsive">
              <Table striped hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Dirección</th>
                    <th>Dueño</th>
                    <th>Inquilino</th>
                    <th>Monto</th>
                    <th>Moneda</th>
                    <th>Método</th>
                    <th>Cobró</th>
                    <th>Notas</th>
                    <th>Estado</th>
                    <th>Total del Período</th>
                    <th>Pagado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const currency = transaction.currency || "PESOS";
                    return (
                      <tr key={transaction.id}>
                        <td>{new Date(transaction.date).toLocaleDateString("es-AR")}</td>
                        <td>{transaction.contract?.property_direction}</td>
                        <td>{transaction.contract?.owner?.name || "N/A"}</td>
                        <td>{transaction.contract?.tenant?.name || "N/A"}</td>
                        <td className={transaction.amount < 0 ? "text-danger" : ""}>
                          {formatMoney(transaction.amount, currency)}
                        </td>
                        <td>
                          <Badge bg={isDollars(currency) ? "info" : "secondary"}>
                            {isDollars(currency) ? "USD" : "Pesos"}
                          </Badge>
                        </td>
                        <td>{getPaymentMethodBadge(transaction.method)}</td>
                        <td>
                          {!isIntermediary(transaction) ? (
                            <Badge bg="secondary">Dueño</Badge>
                          ) : isPendingRemit(transaction) ? (
                            <Badge bg="warning" text="dark">Por rendir</Badge>
                          ) : (
                            <Badge bg="success">
                              Rendido
                              {transaction.remitted_at
                                ? ` ${new Date(transaction.remitted_at).toLocaleDateString("es-AR")}`
                                : ""}
                            </Badge>
                          )}
                        </td>
                        <td>{renderNotes(transaction.notes, transaction.method)}</td>
                        <td>{getStatusBadge(transaction.period?.payment_status)}</td>
                        <td>{formatMoney(transaction.period?.total_amount, currency)}</td>
                        <td>{formatMoney(transaction.period?.amount_paid, currency)}</td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            {isPendingRemit(transaction) && transaction.history_id && (
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => handleRemit(transaction)}
                              >
                                Ya se lo pasé al dueño
                              </Button>
                            )}
                            {transaction.amount > 0 && transaction.period?.id && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setCreditTx(transaction)}
                              >
                                Nota de crédito
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!transactions.length && (
                    <tr>
                      <td colSpan={13} className="text-center text-muted py-4">
                        No hay transacciones para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        {!loading && (
          <Card.Footer className="bg-white">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
              <small className="text-muted">
                {total} transacción{total === 1 ? "" : "es"}
              </small>
              {pages > 1 && (
                <Pagination className="mb-0">
                  <Pagination.Prev
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  />
                  {pageItems.map((p) => (
                    <Pagination.Item
                      key={p}
                      active={p === page}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  />
                </Pagination>
              )}
            </div>
          </Card.Footer>
        )}
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
