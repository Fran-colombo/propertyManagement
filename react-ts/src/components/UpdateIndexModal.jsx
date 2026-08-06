import { useState, useEffect } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import { applyContractIndex } from "../api/contract";

const UpdateIndexModal = ({ show, onHide, contract, onUpdate }) => {
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (show) {
      setError(null);
      setNewValue("");
      setUpdating(false);
    }
  }, [show, contract?.id]);

  const handleSubmit = async () => {
    if (!contract?.id || newValue === "") return;

    try {
      setUpdating(true);
      setError(null);

      await applyContractIndex(contract.id, parseFloat(newValue));

      if (onUpdate) onUpdate();
      onHide();
    } catch (err) {
      console.error("Error applying index:", err);
      setError(err.message || "Error al aplicar el índice a este contrato");
    } finally {
      setUpdating(false);
    }
  };

  const propertyLabel = contract?.property?.direction || "Contrato";
  const tenantLabel = contract?.tenant?.name || "";
  const indexLabel = contract?.index_type || "IPC/ICL";
  const freqLabel = contract?.frequency_adjustment || "";

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Aplicar índice</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        {!contract?.id ? (
          <Alert variant="warning">Seleccioná un contrato para aplicar el índice.</Alert>
        ) : (
          <Form>
            <p className="mb-2">
              <strong>{propertyLabel}</strong>
              {tenantLabel ? ` — ${tenantLabel}` : ""}
            </p>
            <p className="text-muted small mb-3">
              Índice: {indexLabel}
              {freqLabel ? ` · Ajuste ${freqLabel.toLowerCase()}` : ""}
              <br />
              Solo actualiza este contrato desde el próximo período de ajuste pendiente. No modifica períodos anteriores ni otros contratos.
            </p>

            <Form.Group className="mb-3">
              <Form.Label>Porcentaje de variación (%)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                disabled={updating}
                placeholder="Ej: 12.5"
              />
            </Form.Group>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={updating}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={updating || !contract?.id || newValue === ""}
        >
          {updating ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> Aplicando...
            </>
          ) : (
            "Aplicar"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UpdateIndexModal;
