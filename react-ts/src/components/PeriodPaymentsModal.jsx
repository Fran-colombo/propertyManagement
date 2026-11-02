import { useEffect, useState } from "react";
import { Modal, Button, Table, Spinner, Alert, Badge, Form } from "react-bootstrap";
import { getTransactionsByPeriod, updatePaymentDate } from "../api/transaction";
import { formatISODate, paymentMethodLabel } from "../utils/paymentInfo";

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PeriodPaymentsModal({ show, onHide, period, onChanged }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const loadPayments = async (periodId, isCancelled = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactionsByPeriod(periodId);
      if (!isCancelled()) setPayments(data || []);
    } catch (err) {
      if (!isCancelled()) {
        setPayments([]);
        setError(err.message || "No se pudieron cargar los pagos.");
      }
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  };

  useEffect(() => {
    if (!show || !period?.id) return;
    let cancelled = false;
    setEditingId(null);
    setChanged(false);
    loadPayments(period.id, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [show, period?.id]);

  const handleClose = () => {
    setEditingId(null);
    if (changed) onChanged?.();
    onHide();
  };

  const startEdit = (payment) => {
    setEditingId(payment.history_id);
    setEditDate(String(payment.date || "").slice(0, 10));
    setError(null);
  };

  const saveDate = async () => {
    if (!editDate) return;
    setSaving(true);
    setError(null);
    try {
      await updatePaymentDate(editingId, editDate);
      setEditingId(null);
      setChanged(true);
      await loadPayments(period.id);
    } catch (err) {
      setError(err.message || "No se pudo actualizar la fecha.");
    } finally {
      setSaving(false);
    }
  };

  const tenantName = period?.contract?.tenant?.name;
  const remaining = Math.max(
    0,
    Number(period?.total_amount || 0) - Number(period?.amount_paid || 0)
  );

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Pagos del período</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {period && (
          <p className="small mb-3">
            {tenantName && (
              <>
                <strong>{tenantName}</strong> ·{" "}
              </>
            )}
            {formatISODate(period.start_date)} - {formatISODate(period.end_date)}
            <br />
            Total ${money(period.total_amount)} · Pagado ${money(period.amount_paid)}
            {remaining > 0.009 && <> · Falta ${money(remaining)}</>}
          </p>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : payments.length === 0 ? (
          !error && <Alert variant="info">No hay pagos registrados para este período.</Alert>
        ) : (
          <div className="table-responsive">
            <Table striped bordered size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Cobró</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.history_id || p.id}>
                    <td style={{ minWidth: 150 }}>
                      {editingId && editingId === p.history_id ? (
                        <>
                          <Form.Control
                            type="date"
                            size="sm"
                            value={editDate}
                            max={todayIso()}
                            onChange={(e) => setEditDate(e.target.value)}
                            disabled={saving}
                          />
                          <div className="d-flex gap-1 mt-1">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={saveDate}
                              disabled={saving || !editDate}
                            >
                              {saving ? "Guardando..." : "Guardar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => setEditingId(null)}
                              disabled={saving}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {formatISODate(p.date) || "—"}
                          {p.history_id > 0 && (
                            <Button
                              size="sm"
                              variant="link"
                              className="p-0 ms-2 align-baseline"
                              onClick={() => startEdit(p)}
                              disabled={editingId !== null}
                            >
                              Cambiar
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                    <td className={Number(p.amount) < 0 ? "text-danger" : ""}>
                      ${money(p.amount)}
                    </td>
                    <td>{paymentMethodLabel(p.method) || "—"}</td>
                    <td>
                      {String(p.received_by || "").toUpperCase() === "INTERMEDIARIO" ? (
                        <>
                          Intermediario{" "}
                          {p.remitted_to_owner ? (
                            <Badge bg="success">Rendido</Badge>
                          ) : (
                            <Badge bg="warning" text="dark">Sin rendir</Badge>
                          )}
                        </>
                      ) : (
                        "Dueño"
                      )}
                    </td>
                    <td>
                      <small>{p.notes || "—"}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
