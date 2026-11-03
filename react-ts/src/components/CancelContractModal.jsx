import { useEffect, useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import { cancelContractDetailed } from "../api/contract";
import FeedbackModal from "./FeedbackModal";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const EARLY_LEAVE_DAYS = 10;

function leaveMonthInfo(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return { name: MONTHS[month - 1], day, early: day <= EARLY_LEAVE_DAYS };
}

const emptyForm = () => ({
  cancelled_by: "INQUILINO",
  reason: "",
  effective_date: todayISO(),
  settlement_amount: "0",
  settlement_direction: "SIN_MONTO",
  waive_remaining_rent: false,
  waive_current_month: false,
});

export default function CancelContractModal({
  show,
  onHide,
  contractId,
  propertyLabel,
  onCancelled,
}) {
  const [form, setForm] = useState(emptyForm);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (show) {
      setForm(emptyForm());
      setReceipt(null);
      setError("");
      setSaving(false);
      setFeedback(null);
    }
  }, [show]);

  const leaveMonth = leaveMonthInfo(form.effective_date);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contractId) {
      setError("No hay contrato seleccionado");
      return;
    }
    if (!form.reason.trim() || form.reason.trim().length < 3) {
      setError("Indicá el motivo de la baja (mínimo 3 caracteres)");
      return;
    }
    if (
      form.settlement_direction !== "SIN_MONTO" &&
      (!form.settlement_amount || Number(form.settlement_amount) <= 0)
    ) {
      setError("Indicá el monto del acuerdo");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await cancelContractDetailed(contractId, {
        ...form,
        settlement_amount: Number(form.settlement_amount || 0),
        receipt,
      });
      onCancelled?.();
      setFeedback({
        variant: "success",
        title: "Contrato finalizado",
        message: "El contrato se dio de baja correctamente.",
      });
    } catch (err) {
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "Error al cancelar el contrato",
      });
    } finally {
      setSaving(false);
    }
  };

  const closeFeedback = () => {
    const variant = feedback?.variant;
    setFeedback(null);
    if (variant !== "danger") {
      onHide();
    }
  };

  return (
    <>
    <Modal show={show} onHide={onHide} backdrop="static" centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Finalizar contrato</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {propertyLabel && (
            <p className="text-muted mb-3">
              Contrato: <strong>{propertyLabel}</strong>
            </p>
          )}
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>¿Quién solicita la baja? *</Form.Label>
            <Form.Select
              name="cancelled_by"
              value={form.cancelled_by}
              onChange={handleChange}
            >
              <option value="INQUILINO">Inquilino</option>
              <option value="PROPIETARIO">Propietario</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Fecha de salida / baja *</Form.Label>
            <Form.Control
              type="date"
              name="effective_date"
              value={form.effective_date}
              onChange={handleChange}
              required
            />
            <Form.Text className="text-muted">
              La propiedad sigue ocupada hasta esa fecha. Después se libera.
              Los períodos posteriores a esa fecha se anulan.
            </Form.Text>
          </Form.Group>

          {leaveMonth && (
            <Form.Group
              className={
                leaveMonth.early
                  ? "mb-3 p-2 border border-warning rounded bg-warning-subtle"
                  : "mb-3"
              }
            >
              <Form.Check
                type="checkbox"
                id="waive_current_month"
                name="waive_current_month"
                checked={form.waive_current_month}
                onChange={handleChange}
                label={`No cobrar el mes de la baja (${leaveMonth.name})`}
              />
              <Form.Text className="text-muted d-block">
                {leaveMonth.early
                  ? `La baja es el día ${leaveMonth.day}: el inquilino no llegó a usar el mes; lo pagado como acuerdo lo cubre. `
                  : ""}
                Si está marcado, el alquiler de {leaveMonth.name} queda como
                contrato finalizado y deja de figurar por vencer.
              </Form.Text>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="waive_remaining_rent"
              name="waive_remaining_rent"
              checked={form.waive_remaining_rent}
              onChange={handleChange}
              label="El inquilino no paga desde el mes siguiente hasta la fecha de salida"
            />
            <Form.Text className="text-muted d-block">
              Si está marcado, se anulan los alquileres desde el mes que viene
              hasta la fecha de baja (el mes actual sigue cobrándose, salvo que
              marques no cobrar el mes de la baja). Si no,
              paga normalmente hasta esa fecha.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Motivo / explicación *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="reason"
              value={form.reason}
              onChange={handleChange}
              placeholder="Detalle por qué se termina el contrato..."
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Acuerdo económico</Form.Label>
            <Form.Select
              name="settlement_direction"
              value={form.settlement_direction}
              onChange={handleChange}
            >
              <option value="SIN_MONTO">Sin monto / no aplica</option>
              <option value="INQUILINO_A_PROPIETARIO">
                Inquilino paga al propietario
              </option>
              <option value="PROPIETARIO_A_INQUILINO">
                Propietario paga al inquilino
              </option>
            </Form.Select>
          </Form.Group>

          {form.settlement_direction !== "SIN_MONTO" && (
            <Form.Group className="mb-3">
              <Form.Label>Monto a pagar *</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                name="settlement_amount"
                value={form.settlement_amount}
                onChange={handleChange}
                onWheel={(e) => e.target.blur()}
              />
            </Form.Group>
          )}

          <Form.Group className="mb-2">
            <Form.Label>Comprobante (opcional)</Form.Label>
            <Form.Control
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            />
            <Form.Text className="text-muted">
              Imagen o PDF del acuerdo / transferencia.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Volver
          </Button>
          <Button variant="danger" type="submit" disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="me-2" /> Guardando...
              </>
            ) : (
              "Confirmar baja"
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
    <FeedbackModal
      show={!!feedback}
      variant={feedback?.variant}
      title={feedback?.title}
      message={feedback?.message}
      onClose={closeFeedback}
    />
    </>
  );
}
