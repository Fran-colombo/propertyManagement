import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { createProperty } from "../api/property";
import { getOwners } from "../api/person";
export default function CreatePropertyModal({ show, onHide, onCreated }) {
  const [form, setForm] = useState({
    direction: "",
    floor: "",
    apartment: "",
    owner_id: ""
  });

  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) loadData();
  }, [show]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [o ] = await Promise.all([getOwners()]);
      setOwners(o || []);
    } catch (e) {
      console.error(e);
      setError("Error cargando datos");
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

    try {
      await createProperty(form);
      onCreated();
      onHide();
    } catch (e) {
      setError("Error al crear la propiedad");
      console.error(e);
    }
  };

  return (
    <Modal show={show} onHide={onHide} backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Nueva Propiedad</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
              {error && <div className="alert alert-danger">{error}</div>}

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
          <Button type="submit" variant="primary" disabled={!isValid()}>
            Guardar
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
