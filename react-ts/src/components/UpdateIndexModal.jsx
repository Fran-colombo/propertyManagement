import { useState, useEffect, useRef } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import { applyContractIndex } from "../api/contract";
import { getIpc } from "../api/index";
import FeedbackModal from "./FeedbackModal";

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const UpdateIndexModal = ({ show, onHide, contract, currentRent, onUpdate }) => {
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [loadingIpc, setLoadingIpc] = useState(false);
  const [newIndexValue, setNewIndexValue] = useState("");
  const [percent, setPercent] = useState("");
  const [ipcPeriod, setIpcPeriod] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [editSource, setEditSource] = useState(null);
  const loadedForId = useRef(null);

  const reference =
    contract?.last_index_value ?? contract?.base_index_value ?? null;
  const isIpc = contract?.index_type === "IPC";
  const rentBefore = Number(
    currentRent ?? contract?.base_rent ?? 0
  );
  const pctNum = percent === "" || Number.isNaN(Number(percent)) ? null : Number(percent);
  const rentAfter =
    pctNum == null ? null : round2(rentBefore * (1 + pctNum / 100));

  useEffect(() => {
    if (!show) {
      loadedForId.current = null;
      return;
    }
    // Don't reset while showing success/error feedback (parent refresh can change `reference`)
    if (feedback) return;

    const id = contract?.id;
    if (!id || loadedForId.current === id) return;
    loadedForId.current = id;

    setError(null);
    setUpdating(false);
    setNewIndexValue("");
    setPercent("");
    setIpcPeriod("");
    setEditSource(null);

    if (!isIpc) return;

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
          const pct = round4(
            ((latest - Number(reference)) / Number(reference)) * 100
          );
          setPercent(String(pct));
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err.message ||
            "No se pudo obtener el IPC actual. Podés cargar el % a mano."
        );
      } finally {
        if (!cancelled) setLoadingIpc(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [show, contract?.id, isIpc, reference, feedback]);

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

      const msg =
        rentAfter != null
          ? `Se aplicó +${percent}% . El alquiler pasa de $${rentBefore.toLocaleString("es-AR")} a $${rentAfter.toLocaleString("es-AR")} desde el próximo período de ajuste.`
          : `Se aplicó una variación del ${percent}% a este contrato.`;

      setFeedback({
        variant: "success",
        title: "Índice aplicado",
        message: msg,
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
      if (onUpdate) onUpdate();
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
            <Alert variant="warning">
              Seleccioná un contrato para aplicar el índice.
            </Alert>
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
                Solo actualiza desde el próximo período de ajuste pendiente. No
                modifica meses anteriores ni otros contratos.
              </p>

              {isIpc && (
                <>
                  <Alert variant="info" className="small py-2">
                    El número grande (ej. <strong>12.078</strong>) es el{" "}
                    <strong>valor del índice</strong> que publica el INDEC,{" "}
                    <strong>no un porcentaje</strong>. El aumento del alquiler
                    es el campo <strong>Porcentaje de variación (%)</strong> de
                    abajo.
                  </Alert>
                  <p className="small mb-2">
                    Valor IPC de referencia:{" "}
                    <strong>
                      {reference != null
                        ? Number(reference).toLocaleString("es-AR")
                        : "—"}
                    </strong>
                    {contract?.last_index_value != null
                      ? " (último guardado)"
                      : contract?.base_index_value != null
                      ? " (base del contrato)"
                      : ""}
                  </p>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      Valor IPC nuevo {loadingIpc ? "(cargando…)" : ""}
                    </Form.Label>
                    <Form.Control
                      type="number"
                      step="0.0001"
                      value={newIndexValue}
                      onChange={(e) => handleIndexChange(e.target.value)}
                      disabled={updating || loadingIpc}
                      placeholder="Valor del índice (no es %)"
                    />
                    {ipcPeriod && (
                      <Form.Text className="text-muted">
                        Período oficial: {ipcPeriod}
                      </Form.Text>
                    )}
                  </Form.Group>
                </>
              )}

              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Porcentaje de variación del alquiler (%)</strong>
                </Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={percent}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  disabled={updating}
                  placeholder="Ej: 12.5"
                />
                <Form.Text className="text-muted">
                  Este es el % que sube el alquiler. Podés editarlo a mano (ej.
                  12).
                </Form.Text>
              </Form.Group>

              {rentAfter != null && rentBefore > 0 && (
                <Alert variant="secondary" className="small py-2 mb-0">
                  Vista previa: ${rentBefore.toLocaleString("es-AR")} →{" "}
                  <strong>${rentAfter.toLocaleString("es-AR")}</strong> (
                  {pctNum >= 0 ? "+" : ""}
                  {pctNum}%)
                </Alert>
              )}
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
