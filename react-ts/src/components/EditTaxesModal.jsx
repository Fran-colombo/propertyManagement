import { useState, useEffect } from "react";
import { Modal, Form, Button, Row, Col, Alert } from "react-bootstrap";
import FeedbackModal from "./FeedbackModal";

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
        message: "Los montos se guardaron y el total del mes se recalculó (alquiler + servicios).",
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

  const active = period?.active_taxes || {};
  const rent = Number(period?.period_rent ?? period?.indexed_amount ?? 0);
  const taxSum =
    (active.epe ? Number(taxData.epe) || 0 : 0) +
    (active.tgi ? Number(taxData.tgi) || 0 : 0) +
    (active.api ? Number(taxData.api) || 0 : 0) +
    (active.fire_insurance ? Number(taxData.fire_insurance) || 0 : 0);
  const total = rent + taxSum;

  return (
    <>
    <Modal show={show && !feedback} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Editar Impuestos</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <p className="text-muted small">
            El monto de este mes se puede cambiar acá. El total es alquiler
            indexado + servicios (como el seguro incendio de la planilla).
          </p>
          <Row>
            {active.epe &&
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>EPE</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.epe}
                  onChange={(e) => setTaxData({
                    ...taxData,
                    epe: parseFloat(e.target.value) || 0
                  })}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
            }
            { active.tgi &&
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>TGI</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.tgi}
                  onChange={(e) => setTaxData({
                    ...taxData,
                    tgi: parseFloat(e.target.value) || 0
                  })}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
            }
          </Row>
          <Row>
            {active.api &&
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>API</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.api}
                  onChange={(e) => setTaxData({
                    ...taxData,
                    api: parseFloat(e.target.value) || 0
                  })}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
            }
            {active.fire_insurance &&
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Seguro Incendio</Form.Label>
                <Form.Control
                  type="number"
                  value={taxData.fire_insurance}
                  onChange={(e) => setTaxData({
                    ...taxData,
                    fire_insurance: parseFloat(e.target.value) || 0
                  })}
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
              }
          </Row>
          {!active.epe && !active.tgi && !active.api && !active.fire_insurance && (
            <p className="text-muted mb-0">
              Este contrato no tiene impuestos activos. Activá EPE, TGI, API o seguro desde Editar contrato.
            </p>
          )}
          {(active.epe || active.tgi || active.api || active.fire_insurance) && (
            <Alert variant="secondary" className="mb-0 py-2">
              Alquiler ${money(rent)} + servicios ${money(taxSum)} ={" "}
              <strong>total ${money(total)}</strong>
            </Alert>
          )}
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
