import { useState } from "react";
import { Modal, Form, Button, Row, Col } from "react-bootstrap";

export default function EditTaxesModal({ show, onHide, period, onSave }) {
  const [taxData, setTaxData] = useState({
    epe: period?.taxes?.epe || 0,
    tgi: period?.taxes?.tgi || 0,
    api: period?.taxes?.api || 0,
    fire_insurance: period?.taxes?.fire_insurance || 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(period.id, taxData);
  };

  const active = period?.active_taxes || {};

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Editar Impuestos</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}