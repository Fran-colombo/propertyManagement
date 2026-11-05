import { useState, useEffect } from "react";
import { Modal, Form, Button, Row, Col, Alert } from "react-bootstrap";
import FeedbackModal from "./FeedbackModal";
import { formatISODate } from "../utils/paymentInfo";

const TGI_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function tgiMonthLabel(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(period || "");
  if (!match) return period || "";
  return `${TGI_MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export function tgiBreakdownLines(detail) {
  if (!detail || detail.manual) return [];
  const lines = [];
  const current = detail.current;
  if (current && Number(current.total) > 0) {
    const interest = Number(current.interest) || 0;
    lines.push(
      interest > 0
        ? `TGI ${tgiMonthLabel(current.period)} $${money(current.capital)} + interés $${money(interest)}`
        : `TGI ${tgiMonthLabel(current.period)} $${money(current.total)}`
    );
  }
  const catchup = detail.catchup;
  if (catchup && Number(catchup.total) > 0) {
    const interest = Number(catchup.interest) || 0;
    lines.push(
      interest > 0
        ? `TGI ${tgiMonthLabel(catchup.period)} $${money(catchup.capital)} + interés $${money(interest)}`
        : `TGI ${tgiMonthLabel(catchup.period)} $${money(catchup.total)}`
    );
  }
  if (detail.note) lines.push(detail.note);
  return lines;
}

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function EditTaxesModal({ show, onHide, period, onSave }) {
  const [taxData, setTaxData] = useState({
    epe: period?.taxes?.epe || 0,
    tgi: period?.taxes?.tgi || 0,
    api: period?.taxes?.api || 0,
    fire_insurance: period?.taxes?.fire_insurance || 0,
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setTaxData({
      epe: period?.taxes?.epe || 0,
      tgi: period?.taxes?.tgi || 0,
      api: period?.taxes?.api || 0,
      fire_insurance: period?.taxes?.fire_insurance || 0,
    });
    setFeedback(null);
  }, [period, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!period?.id) return;
    setSaving(true);
    try {
      await onSave(period.id, taxData);
      setFeedback({
        variant: "success",
        title: "Impuestos actualizados",
        message: "Se actualizó solo este mes. Los otros períodos no se modificaron.",
      });
    } catch (err) {
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "Error al actualizar los impuestos.",
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

  const rent = Number(period?.period_rent ?? period?.indexed_amount ?? 0);
  const taxSum =
    (Number(taxData.epe) || 0) +
    (Number(taxData.tgi) || 0) +
    (Number(taxData.api) || 0) +
    (Number(taxData.fire_insurance) || 0);
  const lateFee = Number(period?.late_fee_amount || 0);
  const total = rent + taxSum + lateFee;

  const setAmount = (field) => (e) => {
    setTaxData((prev) => ({
      ...prev,
      [field]: parseFloat(e.target.value) || 0,
    }));
  };

  return (
    <>
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
          <Modal.Title>
            Editar impuestos
            {period?.start_date && period?.end_date
              ? ` · ${formatISODate(period.start_date)} – ${formatISODate(period.end_date)}`
              : ""}
          </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <p className="text-muted small">
            Solo cambia este mes: EPE, TGI, API y seguro. Los otros períodos
            quedan igual y su saldo a pagar no se toca. Cero si ese mes no
            corresponde. El total es alquiler indexado + estos gastos.
          </p>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>EPE</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.epe}
                  onChange={setAmount("epe")}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>TGI</Form.Label>
                {tgiBreakdownLines(period?.tgi_detail).length > 0 && (
                  <div className="small text-muted mb-1">
                    {tgiBreakdownLines(period.tgi_detail).map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                )}
                {period?.tgi_detail?.manual && (
                  <div className="small text-muted mb-1">
                    Monto cargado a mano.
                    {period?.contract?.tgi_mode === "siat"
                      ? " Para volver al SIAT usá Actualizar TGI: carga solo este mes, no los próximos."
                      : ""}
                  </div>
                )}
                <Form.Control
                  type="number"
                  value={taxData.tgi}
                  onChange={setAmount("tgi")}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>API</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.api}
                  onChange={setAmount("api")}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Seguro contra incendio</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.fire_insurance}
                  onChange={setAmount("fire_insurance")}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
          </Row>
          <Alert variant="secondary" className="mb-0 py-2">
            Alquiler ${money(rent)} + extras ${money(taxSum)}
            {lateFee > 0 ? ` + recargo $${money(lateFee)}` : ""} ={" "}
            <strong>total ${money(total)}</strong>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar Cambios"}
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
