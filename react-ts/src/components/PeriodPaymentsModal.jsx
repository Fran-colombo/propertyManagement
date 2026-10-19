import { useEffect, useState } from "react";
import { Modal, Button, Table, Spinner, Alert, Badge } from "react-bootstrap";
import { getTransactionsByPeriod } from "../api/transaction";
import { formatISODate, paymentMethodLabel } from "../utils/paymentInfo";

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PeriodPaymentsModal({ show, onHide, period }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!show || !period?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTransactionsByPeriod(period.id)
      .then((data) => {
        if (!cancelled) setPayments(data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setPayments([]);
          setError(err.message || "No se pudieron cargar los pagos.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show, period?.id]);

  const tenantName = period?.contract?.tenant?.name;
  const remaining = Math.max(
    0,
    Number(period?.total_amount || 0) - Number(period?.amount_paid || 0)
  );

  return (
    <Modal show={show} onHide={onHide} size="lg">
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
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : error ? (
          <Alert variant="danger">{error}</Alert>
        ) : payments.length === 0 ? (
          <Alert variant="info">No hay pagos registrados para este período.</Alert>
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
                    <td>{formatISODate(p.date) || "—"}</td>
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
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
