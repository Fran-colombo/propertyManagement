import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { createProperty, updateProperty } from "../api/property";
import { getOwners } from "../api/person";
import FeedbackModal from "./FeedbackModal";

const emptyForm = {
  direction: "",
  floor: "",
  apartment: "",
  owner_id: "",
};

export default function CreatePropertyModal({ show, onHide, onCreated, property = null }) {
  const isEdit = Boolean(property?.id);
  const [form, setForm] = useState(emptyForm);

  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (show) {
      setFeedback(null);
      setError("");
      if (property) {
        setForm({
          direction: property.direction || "",
          floor: property.floor || "",
          apartment: property.apartment || "",
          owner_id: property.owner?.id ? String(property.owner.id) : "",
        });
      } else {
        setForm(emptyForm);
      }
      loadData();
    }
  }, [show, property]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const o = await getOwners();
      setOwners(o || []);
    } catch (e) {
      console.error(e);
      setError("Error cargando dueños. Podés reintentar o crear un propietario en Personas.");
      setOwners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const isValid = () => {
    return form.direction && form.owner_id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid()) {
      setError("Completá los campos obligatorios");
      return;
    }

    const payload = {
      ...form,
      owner_id: parseInt(form.owner_id, 10),
    };

    try {
      setError("");
      if (isEdit) {
        await updateProperty(property.id, payload);
        onCreated();
        setFeedback({
          variant: "success",
          title: "Propiedad actualizada",
          message: "La propiedad se actualizó correctamente.",
        });
      } else {
        await createProperty(payload);
        onCreated();
        setFeedback({
          variant: "success",
          title: "Propiedad creada",
          message: "La propiedad se creó correctamente.",
        });
      }
    } catch (e) {
      setFeedback({
        variant: "danger",
        title: "Error",
        message: e.message || (isEdit ? "Error al actualizar la propiedad" : "Error al crear la propiedad"),
      });
      console.error(e);
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
    <Modal show={show && !feedback} onHide={onHide} backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{isEdit ? "Editar propiedad" : "Nueva Propiedad"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}

              {!error && owners.length === 0 && (
                <Alert variant="info">
                  No hay propietarios todavía. Creá uno en Personas antes de agregar una propiedad.
                </Alert>
              )}

              <Form.Group className="mb-2">
                <Form.Label>Dirección *</Form.Label>
                <Form.Control
                  type="text"
                  name="direction"
                  value={form.direction}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Piso</Form.Label>
                <Form.Control
                  type="text"
                  name="floor"
                  value={form.floor}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Departamento</Form.Label>
                <Form.Control
                  type="text"
                  name="apartment"
                  value={form.apartment}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Dueño *</Form.Label>
                <Form.Select
                  name="owner_id"
                  value={form.owner_id}
                  onChange={handleChange}
                  disabled={owners.length === 0}
                >
                  <option value="">Seleccione dueño</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} - {o.email}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!isValid() || loading}>
            Guardar
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
