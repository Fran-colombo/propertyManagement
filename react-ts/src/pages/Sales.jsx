import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Pagination,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Calendar, Search } from "react-bootstrap-icons";
import { collectSaleInstallment, getSales } from "../api/sale";

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
  return String(currency || "PESOS").toUpperCase() === "DOLARES";
}

function money(amount, currency) {
  const prefix = isDollars(currency) ? "U$S" : "$";
  return `${prefix} ${Number(amount || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusBadge(status) {
  const value = String(status || "").toUpperCase();
  if (value === "PAGADA") return <Badge bg="success">Pagada</Badge>;
  if (value === "PARCIAL") return <Badge bg="warning" text="dark">Parcial</Badge>;
  return <Badge bg="secondary">Pendiente</Badge>;
}

function installmentSummary(sale) {
  const list = sale.installments || [];
  const paid = list.filter((inst) => Number(inst.remaining) <= 0.009).length;
  return `${list.length} cuota${list.length === 1 ? "" : "s"} · ${paid} cobrada${paid === 1 ? "" : "s"}`;
}

function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function isAdvance(inst) {
  return String(inst?.kind || "").toLowerCase() === "adelanto";
}

function nextPendingInstallment(sale) {
  return (sale.installments || [])
    .filter((inst) => Number(inst.remaining) > 0.009)
    .sort((a, b) => {
      const rank = (isAdvance(a) ? 0 : 1) - (isAdvance(b) ? 0 : 1);
      if (rank !== 0) return rank;
      return String(a.due_date).localeCompare(String(b.due_date));
    })[0] || null;
}

function kindBadge(inst) {
  if (isAdvance(inst)) return <Badge bg="info">Adelanto</Badge>;
  return <Badge bg="light" text="dark">Cuota</Badge>;
}

function isOverdue(inst) {
  return inst && String(inst.due_date).slice(0, 10) < todayISO();
}

export default function Sales() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [managingFilter, setManagingFilter] = useState("");
  const [collectFilter, setCollectFilter] = useState("pending");
  const [pendingSales, setPendingSales] = useState(0);
  const [pendingInstallments, setPendingInstallments] = useState(0);
  const [overdueInstallments, setOverdueInstallments] = useState(0);
  const [cuotasSale, setCuotasSale] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "transferencia",
    received_by: "DUENO",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [overpayOpen, setOverpayOpen] = useState(false);
  const [overpayReason, setOverpayReason] = useState("");
  const [overpayNote, setOverpayNote] = useState("");
  const [overpayError, setOverpayError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFilter, statusFilter, managingFilter, collectFilter]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getSales({
        page,
        pageSize: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: statusFilter || undefined,
        keepManaging: managingFilter || undefined,
        month: dateFilter || undefined,
        collect: collectFilter || undefined,
      });
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 0);
      setPendingSales(data?.pending_sales || 0);
      setPendingInstallments(data?.pending_installments || 0);
      setOverdueInstallments(data?.overdue_installments || 0);
      if (cuotasSale) {
        const updated = (data?.items || []).find((sale) => sale.id === cuotasSale.id);
        if (updated) setCuotasSale(updated);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ventas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, debouncedSearch, dateFilter, statusFilter, managingFilter, collectFilter]);

  const openPay = (sale, inst) => {
    setPayTarget({ sale, inst });
    setOverpayOpen(false);
    setOverpayReason("");
    setOverpayNote("");
    setOverpayError("");
    setPayForm({
      amount: String(inst.remaining),
      method: "transferencia",
      received_by: "DUENO",
      notes: "",
    });
  };

  const extraPay = () => {
    if (!payTarget) return 0;
    return Math.round((Number(payForm.amount) - Number(payTarget.inst.remaining || 0)) * 100) / 100;
  };

  const sendCollect = async (overpay) => {
    if (!payTarget) return;
    setSaving(true);
    try {
      const updated = await collectSaleInstallment(payTarget.sale.id, payTarget.inst.id, {
        amount: Number(payForm.amount),
        method: payForm.method,
        received_by: payForm.received_by,
        notes: payForm.notes.trim() || undefined,
        overpay_reason: overpay?.reason,
        overpay_note: overpay?.note,
      });
      setOverpayOpen(false);
      setPayTarget(null);
      setCuotasSale(updated);
      await load();
    } catch (err) {
      if (overpayOpen) {
        setOverpayError(err.message || "No se pudo registrar el cobro");
      } else {
        setError(err.message || "No se pudo registrar el cobro");
      }
    } finally {
      setSaving(false);
    }
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    const extra = extraPay();
    if (extra > 0.009) {
      setOverpayReason("");
      setOverpayNote("");
      setOverpayError("");
      setOverpayOpen(true);
      return;
    }
    await sendCollect();
  };

  const confirmOverpay = async () => {
    if (!overpayReason) {
      setOverpayError("Elegí un motivo.");
      return;
    }
    if (overpayReason === "otro" && !overpayNote.trim()) {
      setOverpayError("Especificá por qué se pagó de más.");
      return;
    }
    await sendCollect({ reason: overpayReason, note: overpayNote.trim() });
  };

  const pageItems = [];
  const totalPages = Math.max(pages, 1);
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pageItems.push(p);
  }

  return (
    <div>
      <h2 className="h4">Ventas</h2>
      <p className="text-muted small">
        Lo primero que ves son las ventas con cuotas por cobrar. El detalle de cuotas sigue en el modal.
      </p>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {pendingInstallments > 0 && (
        <Alert variant={overdueInstallments ? "warning" : "info"} className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <strong>
              {pendingInstallments} cuota{pendingInstallments === 1 ? "" : "s"} por cobrar
            </strong>
            {overdueInstallments > 0 && (
              <>
                {" "}
                · {overdueInstallments} vencida{overdueInstallments === 1 ? "" : "s"}
              </>
            )}
            {pendingSales > 0 && (
              <span className="text-muted">
                {" "}
                en {pendingSales} venta{pendingSales === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {collectFilter !== "pending" && (
            <Button
              size="sm"
              variant="outline-dark"
              onClick={() => {
                setCollectFilter("pending");
                setStatusFilter("");
                setDateFilter("");
              }}
            >
              Ver por cobrar
            </Button>
          )}
        </Alert>
      )}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col xs={12}>
              <div className="d-flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={collectFilter === "pending" ? "warning" : "outline-warning"}
                  onClick={() => {
                    setCollectFilter("pending");
                    setStatusFilter("");
                  }}
                >
                  Por cobrar
                  {pendingInstallments > 0 ? ` (${pendingInstallments})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant={collectFilter === "overdue" ? "danger" : "outline-danger"}
                  onClick={() => {
                    setCollectFilter("overdue");
                    setStatusFilter("");
                  }}
                >
                  Vencidas
                  {overdueInstallments > 0 ? ` (${overdueInstallments})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant={collectFilter === "" ? "secondary" : "outline-secondary"}
                  onClick={() => setCollectFilter("")}
                >
                  Todas las ventas
                </Button>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Buscar por comprador o propiedad..."
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
                Mes de la venta o del vencimiento de una cuota.
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
            <Col xs={12} md={2}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  if (e.target.value) setCollectFilter("");
                }}
                aria-label="Filtrar estado"
              >
                <option value="">Todos los estados</option>
                <option value="PAGADA">Pagada</option>
                <option value="PARCIAL">Parcial</option>
                <option value="PENDIENTE">Pendiente</option>
              </Form.Select>
            </Col>
            <Col xs={12} md={2}>
              <Form.Select
                value={managingFilter}
                onChange={(e) => setManagingFilter(e.target.value)}
                aria-label="Filtrar administración"
              >
                <option value="">Toda la cartera</option>
                <option value="yes">Sigo administrando</option>
                <option value="no">Fuera de cartera</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {loading ? (
        <Spinner animation="border" />
      ) : (
        <>
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Propiedad</th>
                  <th>Comprador</th>
                  <th>Moneda</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Administración</th>
                  <th>Cuotas</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sale) => {
                  const nextInst = nextPendingInstallment(sale);
                  const overdue = isOverdue(nextInst);
                  return (
                  <tr key={sale.id}>
                    <td>{new Date(sale.sale_date).toLocaleDateString("es-AR")}</td>
                    <td>{sale.property_direction}</td>
                    <td>{sale.buyer_name || "—"}</td>
                    <td>{isDollars(sale.currency) ? "Dólares" : "Pesos"}</td>
                    <td>{money(sale.total_amount, sale.currency)}</td>
                    <td>{money(sale.amount_paid, sale.currency)}</td>
                    <td>{Number(sale.remaining) <= 0.009 ? "—" : money(sale.remaining, sale.currency)}</td>
                    <td>{statusBadge(sale.status)}</td>
                    <td>
                      {sale.keep_managing ? (
                        <Badge bg="info">Sigo administrando</Badge>
                      ) : (
                        <Badge bg="dark">Fuera de cartera</Badge>
                      )}
                    </td>
                    <td>
                      {nextInst ? (
                        <div className="mb-2">
                          <div className="fw-semibold">
                            Cobrar {money(nextInst.remaining, sale.currency)}{" "}
                            {kindBadge(nextInst)}
                          </div>
                          <div className="small text-muted">
                            Vence {new Date(nextInst.due_date).toLocaleDateString("es-AR")}
                            {overdue && (
                              <>
                                {" "}
                                <Badge bg="danger">Vencida</Badge>
                              </>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={overdue ? "danger" : "success"}
                            className="mt-1 me-2"
                            onClick={() => openPay(sale, nextInst)}
                          >
                            Cobrar
                          </Button>
                        </div>
                      ) : (
                        <div className="small text-muted mb-1">{installmentSummary(sale)}</div>
                      )}
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => {
                          setCuotasSale(sale);
                          setPayTarget(null);
                        }}
                      >
                        Ver cuotas
                      </Button>
                    </td>
                  </tr>
                  );
                })}
                {!items.length && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted">
                      No hay ventas para este filtro.
                      {collectFilter === "pending"
                        ? " No hay cuotas pendientes de cobro."
                        : collectFilter === "overdue"
                        ? " No hay cuotas vencidas."
                        : ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <small className="text-muted">
              {total} venta{total === 1 ? "" : "s"}
              {pages > 0 ? ` · página ${page} de ${totalPages}` : ""}
            </small>
            <Pagination className="mb-0">
              <Pagination.Prev
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              />
              {pageItems.map((p) => (
                <Pagination.Item key={p} active={p === page} onClick={() => setPage(p)}>
                  {p}
                </Pagination.Item>
              ))}
              <Pagination.Next
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </Pagination>
          </div>
        </>
      )}

      <Modal
        show={!!cuotasSale}
        onHide={() => {
          setCuotasSale(null);
          setPayTarget(null);
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Cuotas — {cuotasSale?.property_direction}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cuotasSale && (
            <>
              <p className="small text-muted mb-3">
                Comprador: {cuotasSale.buyer_name || "—"} · Total{" "}
                {money(cuotasSale.total_amount, cuotasSale.currency)} · {statusBadge(cuotasSale.status)}
              </p>
              <Table striped bordered hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th>Pagado</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(cuotasSale.installments || []).map((inst) => {
                    const pending = Number(inst.remaining) > 0.009;
                    const overdue = pending && isOverdue(inst);
                    return (
                      <tr key={inst.id} className={overdue ? "table-danger" : ""}>
                        <td>{kindBadge(inst)}</td>
                        <td>{new Date(inst.due_date).toLocaleDateString("es-AR")}</td>
                        <td>{money(inst.amount, cuotasSale.currency)}</td>
                        <td>{money(inst.amount_paid, cuotasSale.currency)}</td>
                        <td>{pending ? money(inst.remaining, cuotasSale.currency) : "—"}</td>
                        <td>
                          {!pending ? (
                            <Badge bg="success">Cobrada</Badge>
                          ) : overdue ? (
                            <Badge bg="danger">Vencida</Badge>
                          ) : (
                            <Badge bg="warning" text="dark">Pendiente</Badge>
                          )}
                        </td>
                        <td>
                          {pending && (
                            <Button
                              size="sm"
                              variant={overdue ? "danger" : "success"}
                              onClick={() => openPay(cuotasSale, inst)}
                            >
                              Cobrar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setCuotasSale(null);
              setPayTarget(null);
            }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!payTarget && !overpayOpen} onHide={() => setPayTarget(null)} centered>
        <Form onSubmit={submitPay}>
          <Modal.Header closeButton>
            <Modal.Title>
              {payTarget && isAdvance(payTarget.inst) ? "Cobrar adelanto" : "Cobrar cuota"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="small text-muted">
              {payTarget?.sale?.property_direction} ·{" "}
              {payTarget && isAdvance(payTarget.inst) ? "adelanto pactado" : "cuota"} · saldo{" "}
              {money(payTarget?.inst?.remaining, payTarget?.sale?.currency)}
            </p>
            <Form.Group className="mb-3">
              <Form.Label>Monto</Form.Label>
              <Form.Control
                type="number"
                min="0.01"
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Método</Form.Label>
              <Form.Select
                value={payForm.method}
                onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>¿Quién cobró?</Form.Label>
              <Form.Select
                value={payForm.received_by}
                onChange={(e) => setPayForm({ ...payForm, received_by: e.target.value })}
              >
                <option value="DUENO">El dueño vendedor</option>
                <option value="INTERMEDIARIO">Yo / intermediario</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Nota</Form.Label>
              <Form.Control
                value={payForm.notes}
                onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setPayTarget(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Cobrar"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={overpayOpen} onHide={() => setOverpayOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Se está pagando de más</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="small">
            Saldo de la cuota: {money(payTarget?.inst?.remaining, payTarget?.sale?.currency)}
            <br />
            Monto cargado: {money(payForm.amount, payTarget?.sale?.currency)}
            <br />
            Excedente: <strong>{money(extraPay(), payTarget?.sale?.currency)}</strong>
          </Alert>
          <p className="mb-2">¿Cuál es el motivo?</p>
          {overpayError && <Alert variant="danger" className="py-2">{overpayError}</Alert>}
          <Form.Check
            type="radio"
            id="sale-overpay-adelanto"
            name="saleOverpayReason"
            label="Adelanto: se cubre esta cuota y el resto va a las siguientes"
            checked={overpayReason === "adelanto"}
            onChange={() => setOverpayReason("adelanto")}
            className="mb-2"
          />
          <Form.Check
            type="radio"
            id="sale-overpay-otro"
            name="saleOverpayReason"
            label="Otro (especificar)"
            checked={overpayReason === "otro"}
            onChange={() => setOverpayReason("otro")}
            className="mb-2"
          />
          {overpayReason === "otro" && (
            <Form.Control
              as="textarea"
              rows={3}
              className="mt-2"
              placeholder="¿Por qué se pagó de más?"
              value={overpayNote}
              onChange={(e) => setOverpayNote(e.target.value)}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setOverpayOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmOverpay} disabled={saving}>
            {saving ? "Guardando..." : "Confirmar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
