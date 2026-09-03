import { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Pagination, Spinner, Table } from "react-bootstrap";
import { collectSaleInstallment, getSales } from "../api/sale";

const PAGE_SIZE = 20;

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

export default function Sales() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "transferencia",
    received_by: "DUENO",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getSales({ page, pageSize: PAGE_SIZE });
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 0);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ventas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const openPay = (sale, inst) => {
    setPayTarget({ sale, inst });
    setPayForm({
      amount: String(inst.remaining),
      method: "transferencia",
      received_by: "DUENO",
      notes: "",
    });
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    setSaving(true);
    try {
      await collectSaleInstallment(payTarget.sale.id, payTarget.inst.id, {
        amount: Number(payForm.amount),
        method: payForm.method,
        received_by: payForm.received_by,
        notes: payForm.notes.trim() || undefined,
      });
      setPayTarget(null);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo registrar el cobro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="h4">Ventas</h2>
      <p className="text-muted small">
        Contado o cuotas. Los cobros también aparecen en Transacciones como venta,
        separados del alquiler.
      </p>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
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
                {items.map((sale) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.sale_date).toLocaleDateString("es-AR")}</td>
                    <td>{sale.property_direction}</td>
                    <td>{sale.buyer_name || "—"}</td>
                    <td>{isDollars(sale.currency) ? "Dólares" : "Pesos"}</td>
                    <td>{money(sale.total_amount, sale.currency)}</td>
                    <td>{money(sale.amount_paid, sale.currency)}</td>
                    <td>{money(sale.remaining, sale.currency)}</td>
                    <td>{statusBadge(sale.status)}</td>
                    <td>
                      {sale.keep_managing ? (
                        <Badge bg="info">Sigo administrando</Badge>
                      ) : (
                        <Badge bg="dark">Fuera de cartera</Badge>
                      )}
                    </td>
                    <td>
                      {sale.installments.map((inst) => (
                        <div key={inst.id} className="d-flex align-items-center gap-2 mb-1">
                          <small>
                            {new Date(inst.due_date).toLocaleDateString("es-AR")}{" "}
                            {money(inst.amount, sale.currency)}
                            {inst.remaining > 0.009 ? ` · saldo ${money(inst.remaining, sale.currency)}` : " · cobrada"}
                          </small>
                          {inst.remaining > 0.009 && (
                            <Button
                              size="sm"
                              variant="outline-success"
                              onClick={() => openPay(sale, inst)}
                            >
                              Cobrar
                            </Button>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted">
                      Todavía no hay ventas.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              {total} venta{total === 1 ? "" : "s"}
            </small>
            {pages > 1 && (
              <Pagination className="mb-0">
                <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
                <Pagination.Item active>{page}</Pagination.Item>
                <Pagination.Next
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                />
              </Pagination>
            )}
          </div>
        </>
      )}

      <Modal show={!!payTarget} onHide={() => setPayTarget(null)} centered>
        <Form onSubmit={submitPay}>
          <Modal.Header closeButton>
            <Modal.Title>Cobrar cuota</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="small text-muted">
              {payTarget?.sale?.property_direction} · saldo{" "}
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
    </div>
  );
}
