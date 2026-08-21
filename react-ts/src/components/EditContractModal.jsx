import { useEffect, useState } from "react";
import { Modal, Form, Button, Alert, Spinner } from "react-bootstrap";
import { getContract, updateContract, uploadContractDocument } from "../api/contract";
import { mediaUrl } from "../utils/mediaUrl";

const emptyForm = {
  pays_epe: false,
  pays_tgi: false,
  pays_api: false,
  fire_insurance: false,
  notes: "",
  document_path: null,
};

export default function EditContractModal({ show, onHide, contractId, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!show || !contractId) return;
    setError("");
    setFile(null);
    setLoaded(false);
    setForm(emptyForm);
    setLoading(true);
    getContract(contractId)
      .then((data) => {
        setForm({
          pays_epe: !!data.pays_epe,
          pays_tgi: !!data.pays_tgi,
          pays_api: !!data.pays_api,
          fire_insurance: !!data.fire_insurance,
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
        notes: form.notes,
      });
      if (file) {
        await uploadContractDocument(contractId, file);
      }
      if (onSaved) onSaved();
      onHide();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el contrato");
    } finally {
      setSaving(false);
    }
  };

  const documentHref = mediaUrl(form.document_path);

  return (
    <Modal show={show} onHide={onHide} backdrop="static">
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
                Si te olvidaste de marcar EPE, TGI u otros, podés activarlos acá. Después cargá el monto del mes en Impuestos.
              </p>
              <Form.Check
                className="mb-2"
                label="Paga EPE"
                name="pays_epe"
                checked={form.pays_epe}
                onChange={handleChange}
              />
              <Form.Check
                className="mb-2"
                label="Paga TGI"
                name="pays_tgi"
                checked={form.pays_tgi}
                onChange={handleChange}
              />
              <Form.Check
                className="mb-2"
                label="Paga API"
                name="pays_api"
                checked={form.pays_api}
                onChange={handleChange}
              />
              <Form.Check
                className="mb-3"
                label="Seguro contra incendio"
                name="fire_insurance"
                checked={form.fire_insurance}
                onChange={handleChange}
              />
              <Form.Group className="mb-3">
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
                  Si no lo adjuntaste al crear, podés cargarlo ahora. Solo se guarda el archivo: no cambia fechas, alquiler ni impuestos que ya estén cargados.
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
  );
}
