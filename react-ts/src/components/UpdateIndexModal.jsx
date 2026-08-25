import { useState, useEffect } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import { applyContractIndex } from "../api/contract";
import { getIpc } from "../api/index";
import FeedbackModal from "./FeedbackModal";

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

const UpdateIndexModal = ({ show, onHide, contract, onUpdate }) => {
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [loadingIpc, setLoadingIpc] = useState(false);
  const [newIndexValue, setNewIndexValue] = useState("");
  const [percent, setPercent] = useState("");
  const [ipcPeriod, setIpcPeriod] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [editSource, setEditSource] = useState(null); // 'index' | 'percent'

  const reference =
    contract?.last_index_value ?? contract?.base_index_value ?? null;
  const isIpc = contract?.index_type === "IPC";

  useEffect(() => {
    if (!show) return;
    setError(null);
    setFeedback(null);
    setUpdating(false);
    setNewIndexValue("");
    setPercent("");
    setIpcPeriod("");
    setEditSource(null);

    if (!isIpc || !contract?.id) return;

    let cancelled = false;
    const load = async () => {
      setLoadingIpc(true);
      try {
        const data = await getIpc();
        if (cancelled) return;
        const latest = Number(data.value);
        setNewIndexValue(String(latest));
        setIpcPeriod(data.period || "");
        if (reference) {
          const pct = round4(((latest - Number(reference)) / Number(reference)) * 100);
          setPercent(String(pct));
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err.message ||
            "No se pudo obtener el IPC actual. Podés cargarlo a mano."
        );
      } finally {
        if (!cancelled) setLoadingIpc(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [show, contract?.id, isIpc, reference]);

  const handleIndexChange = (raw) => {
    setEditSource("index");
    setNewIndexValue(raw);
    if (raw === "" || !reference) {
      setPercent("");
      return;
    }
    const latest = Number(raw);
    if (Number.isNaN(latest)) return;
    setPercent(
      String(round4(((latest - Number(reference)) / Number(reference)) * 100))
    );
  };

  const handlePercentChange = (raw) => {
    setEditSource("percent");
    setPercent(raw);
    if (raw === "" || !reference) return;
    const pct = Number(raw);
    if (Number.isNaN(pct)) return;
    setNewIndexValue(String(round4(Number(reference) * (1 + pct / 100))));
  };

  const handleSubmit = async () => {
    if (!contract?.id || percent === "") return;

    try {
      setUpdating(true);
      setError(null);

      await applyContractIndex(
        contract.id,
        parseFloat(percent),
        isIpc && newIndexValue !== "" ? parseFloat(newIndexValue) : undefined
      );

      if (onUpdate) onUpdate();
      setFeedback({
        variant: "success",
        title: "Índice aplicado",
        message: `Se aplicó una variación del ${percent}% a este contrato.`,
      });
    } catch (err) {
      console.error("Error applying index:", err);
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "Error al aplicar el índice a este contrato",
      });
    } finally {
      setUpdating(false);
    }
  };

  const closeFeedback = () => {
    const variant = feedback?.variant;
    setFeedback(null);
    if (variant !== "danger") {
      onHide();
    }
  };

  const propertyLabel = contract?.property?.direction || "Contrato";
  const tenantLabel = contract?.tenant?.name || "";
  const indexLabel = contract?.index_type || "IPC/ICL";
  const freqLabel = contract?.frequency_adjustment || "";

  return (
    <>
    <Modal show={show && !feedback} onHide={onHide} centered>
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
              {isIpc && (
                <>
                  <br />
                  El IPC se actualiza solo a mitad de mes. Acá ves el valor sugerido; el alquiler cambia recién cuando confirmás.
                </>
              )}
            </p>

            {isIpc && (
              <>
                <p className="small mb-2">
                  IPC referencia:{" "}
                  <strong>
                    {reference != null ? Number(reference).toLocaleString("es-AR") : "—"}
                  </strong>
                  {contract?.last_index_value != null
                    ? " (último aplicado)"
                    : contract?.base_index_value != null
                    ? " (base del contrato)"
                    : ""}
                </p>
                <Form.Group className="mb-3">
                  <Form.Label>
                    IPC nuevo {loadingIpc ? "(cargando…)" : ""}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.0001"
                    value={newIndexValue}
                    onChange={(e) => handleIndexChange(e.target.value)}
                    disabled={updating || loadingIpc}
                    placeholder="Desde API o a mano"
                  />
                  {ipcPeriod && (
                    <Form.Text className="text-muted">
                      Período oficial: {ipcPeriod}
                      {editSource === "percent" ? " · recalculado desde el %" : ""}
                    </Form.Text>
                  )}
                </Form.Group>
              </>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Porcentaje de variación (%)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={percent}
                onChange={(e) => handlePercentChange(e.target.value)}
                disabled={updating}
                placeholder="Ej: 12.5"
              />
              {isIpc && (
                <Form.Text className="text-muted">
                  Podés editar el % a mano; se recalcula el IPC nuevo (o al revés).
                </Form.Text>
              )}
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
          disabled={updating || !contract?.id || percent === ""}
        >
          {updating ? (
            <>
              <Spinner size="sm" className="me-2" /> Aplicando...
            </>
          ) : (
            "Aplicar"
          )}
        </Button>
      </Modal.Footer>
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
};

export default UpdateIndexModal;
