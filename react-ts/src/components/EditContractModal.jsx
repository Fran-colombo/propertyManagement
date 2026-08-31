import { useEffect, useState } from "react";
import { Modal, Form, Button, Alert, Spinner } from "react-bootstrap";
import { getContract, updateContract, uploadContractDocument } from "../api/contract";
import { mediaUrl } from "../utils/mediaUrl";
import FeedbackModal from "./FeedbackModal";

const emptyForm = {
  pays_epe: false,
  pays_tgi: false,
  pays_api: false,
  fire_insurance: false,
  epe_amount: "",
  tgi_amount: "",
  api_amount: "",
  fire_insurance_amount: "",
  notes: "",
  document_path: null,
};

const SERVICE_ROWS = [
  ["pays_epe", "Paga EPE", "epe_amount"],
  ["pays_tgi", "Paga TGI", "tgi_amount"],
  ["pays_api", "Paga API", "api_amount"],
  ["fire_insurance", "Seguro contra incendio", "fire_insurance_amount"],
];

function optionalAmount(enabled, value) {
  if (!enabled) return null;
  if (value === "" || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function EditContractModal({ show, onHide, contractId, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!show || !contractId) return;
    setError("");
    setFile(null);
    setLoaded(false);
    setForm(emptyForm);
    setFeedback(null);
    setLoading(true);
    getContract(contractId)
      .then((data) => {
        setForm({
          pays_epe: !!data.pays_epe,
          pays_tgi: !!data.pays_tgi,
          pays_api: !!data.pays_api,
          fire_insurance: !!data.fire_insurance,
          epe_amount: data.epe_amount ?? "",
          tgi_amount: data.tgi_amount ?? "",
          api_amount: data.api_amount ?? "",
          fire_insurance_amount: data.fire_insurance_amount ?? "",
          notes: data.notes || "",
          document_path: data.document_path || null,
        });
        setLoaded(true);
      })
      .catch((err) => {
        setError(err.message || "No se pudo cargar el contrato");
        setForm(emptyForm);
        setLoaded(false);
      })
      .finally(() => setLoading(false));
  }, [show, contractId]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contractId || !loaded) return;
    setSaving(true);
    setError("");
    try {
      await updateContract(contractId, {
        pays_epe: form.pays_epe,
        pays_tgi: form.pays_tgi,
        pays_api: form.pays_api,
        fire_insurance: form.fire_insurance,
        epe_amount: optionalAmount(form.pays_epe, form.epe_amount),
        tgi_amount: optionalAmount(form.pays_tgi, form.tgi_amount),
        api_amount: optionalAmount(form.pays_api, form.api_amount),
        fire_insurance_amount: optionalAmount(
          form.fire_insurance,
          form.fire_insurance_amount
        ),
        notes: form.notes,
      });
      if (file) {
        await uploadContractDocument(contractId, file);
      }
      if (onSaved) onSaved();
      setFeedback({
        variant: "success",
        title: "Contrato actualizado",
        message:
          "Los servicios y montos se guardaron. Se actualizó el total de los meses que todavía no están pagados. Los meses ya cobrados no se tocan.",
      });
    } catch (err) {
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "No se pudo actualizar el contrato",
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

  const documentHref = mediaUrl(form.document_path);
  const servicesTotal =
    (form.pays_epe ? Number(form.epe_amount) || 0 : 0) +
    (form.pays_tgi ? Number(form.tgi_amount) || 0 : 0) +
    (form.pays_api ? Number(form.api_amount) || 0 : 0) +
    (form.fire_insurance ? Number(form.fire_insurance_amount) || 0 : 0);

  return (
    <>
    <Modal show={show && !feedback} onHide={onHide} backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Editar contrato</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}
              <p className="text-muted small">
                Activá EPE, TGI, API o el seguro e indicá el monto mensual.
                Ese valor se suma al alquiler (alquiler + servicios = total) en
                los meses pendientes. Si un mes cambia, lo ajustás en Impuestos.
              </p>
              {SERVICE_ROWS.map(([checkName, label, amountName]) => (
                <div
                  key={checkName}
                  className="d-flex flex-wrap align-items-center gap-2 mb-2"
                >
                  <Form.Check
                    className="mb-0"
                    label={label}
                    name={checkName}
                    checked={form[checkName]}
                    onChange={handleChange}
                  />
                  {form[checkName] && (
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      name={amountName}
                      value={form[amountName]}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      placeholder="Monto mensual"
                      style={{ maxWidth: 180 }}
                    />
                  )}
                </div>
              ))}
              {servicesTotal > 0 && (
                <Alert variant="secondary" className="py-2 small">
                  Servicios: <strong>${money(servicesTotal)}</strong> (se suman
                  al alquiler indexado de cada mes pendiente)
                </Alert>
              )}
              <Form.Group className="mb-3 mt-3">
                <Form.Label>Notas</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Archivo del contrato (opcional)</Form.Label>
                {documentHref && (
                  <div className="mb-2">
                    <a href={documentHref} target="_blank" rel="noreferrer">
                      Ver contrato actual
                    </a>
                  </div>
                )}
                <Form.Control
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Form.Text className="text-muted">
                  Si no lo adjuntaste al crear, podés cargarlo ahora. Solo se guarda el archivo: no cambia fechas ni alquiler.
                </Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading || saving || !loaded}>
            {saving ? "Guardando..." : "Guardar"}
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
