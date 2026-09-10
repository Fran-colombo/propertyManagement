import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Spinner } from "react-bootstrap";
import {
  deleteReceiptSignature,
  getReceiptSignature,
  uploadReceiptSignature,
} from "../api/settings";
import { mediaUrl } from "../utils/mediaUrl";

export default function Settings() {
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const inputRef = useRef(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getReceiptSignature();
      setPath(data?.path || null);
    } catch (err) {
      setError(err.message || "No se pudo cargar la firma.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setSaving(true);
      setError("");
      setOk("");
      const data = await uploadReceiptSignature(file);
      setPath(data?.path || null);
      setOk("Firma guardada. Aparece en los recibos de cobro.");
    } catch (err) {
      setError(err.message || "No se pudo subir la firma.");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    try {
      setSaving(true);
      setError("");
      setOk("");
      await deleteReceiptSignature();
      setPath(null);
      setOk("Firma quitada. El recibo vuelve a mostrar una raya para quien cobra.");
    } catch (err) {
      setError(err.message || "No se pudo quitar la firma.");
    } finally {
      setSaving(false);
    }
  };

  const preview = mediaUrl(path);

  return (
    <div>
      <h2 className="h4">Configuración</h2>
      <p className="text-muted">
        La firma se guarda en el servidor (no en git) y se imprime en el recibo
        como quien recibe el pago. El inquilino sigue firmando a mano.
      </p>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {ok && (
        <Alert variant="success" dismissible onClose={() => setOk("")}>
          {ok}
        </Alert>
      )}
      <Card className="shadow-sm" style={{ maxWidth: 520 }}>
        <Card.Body>
          <Card.Title>Firma de quien recibe el pago</Card.Title>
          <Card.Text className="text-muted small">
            PNG con fondo transparente queda mejor. JPG o WEBP también sirven (máx. 2 MB).
          </Card.Text>
          {loading ? (
            <Spinner animation="border" size="sm" />
          ) : preview ? (
            <div className="mb-3 p-3 border rounded bg-white text-center">
              <img
                src={preview}
                alt="Firma cargada"
                style={{ maxHeight: 120, maxWidth: "100%" }}
              />
            </div>
          ) : (
            <p className="text-muted">Todavía no hay firma cargada.</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="d-none"
            onChange={onFile}
          />
          <div className="d-flex flex-wrap gap-2">
            <Button
              disabled={saving}
              onClick={() => inputRef.current?.click()}
            >
              {saving ? "Guardando..." : path ? "Reemplazar firma" : "Cargar firma"}
            </Button>
            {path && (
              <Button variant="outline-danger" disabled={saving} onClick={onRemove}>
                Quitar
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
