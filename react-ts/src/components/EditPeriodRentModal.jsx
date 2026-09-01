import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { updatePeriodRent } from "../api/contract_period";

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function EditPeriodRentModal({
  show,
  onHide,
  period,
  onSaved,
}) {
  const [amount, setAmount] = useState("");
  const [applyForward, setApplyForward] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setAmount(
      period?.indexed_amount != null ? String(period.indexed_amount) : ""
    );
    setApplyForward(false);
    setError("");
    setSaving(false);
  }, [show, period]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!period?.id || !Number.isFinite(value) || value <= 0) {
      setError("Indicá un alquiler mayor a 0.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updatePeriodRent(period.id, {
        indexed_amount: value,
        apply_forward: applyForward,
      });
      if (onSaved) onSaved();
      onHide();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el alquiler.");
    } finally {
      setSaving(false);
    }
  };

  const label = period
    ? `${new Date(period.start_date).toLocaleDateString("es-AR")} — ${new Date(
        period.end_date
      ).toLocaleDateString("es-AR")}`
    : "";

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Cambiar alquiler</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="small text-muted">{label}</p>
          <Form.Group className="mb-3">
            <Form.Label>Alquiler de este período</Form.Label>
            <Form.Control
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => e.target.blur()}
              required
            />
            <Form.Text className="text-muted">
              Actual: ${money(period?.indexed_amount)}. Los servicios del mes se
              mantienen y se suman al total.
            </Form.Text>
          </Form.Group>
          <Form.Check
            type="checkbox"
            id="apply-forward-rent"
            checked={applyForward}
            onChange={(e) => setApplyForward(e.target.checked)}
            label="Desde este mes en adelante (hasta el final del contrato)"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Spinner size="sm" animation="border" /> : "Guardar"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
