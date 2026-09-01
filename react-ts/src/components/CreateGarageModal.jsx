import { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { createGarage, updateGarage } from "../api/garage";
import { getProperties } from "../api/property";
import { getOwners } from "../api/person";
import { FeedbackView } from "./FeedbackModal";

const CreateGarageModal = ({ show, onHide, onCreated, garage = null }) => {
  const isEdit = Boolean(garage?.id);
  const [number, setNumber] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);

  const resetForm = () => {
    setNumber("");
    setOwnerId("");
    setPropertyId("");
    setError("");
  };

  useEffect(() => {
    if (show) {
      setFeedback(null);
      if (garage) {
        setNumber(garage.number || "");
        setOwnerId(garage.owner_id ? String(garage.owner_id) : "");
        setPropertyId(garage.property_id ? String(garage.property_id) : "");
        setError("");
      } else {
        resetForm();
      }
      loadData();
    }
  }, [show, garage]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [ownersData, propsData] = await Promise.all([
        getOwners(),
        getProperties(),
      ]);
      setOwners(ownersData || []);
      setProperties(propsData || []);
    } catch (e) {
      console.error("Error cargando datos:", e);
      setError("Error cargando dueños/propiedades");
    } finally {
      setLoading(false);
    }
  };

  const ownerProperties = useMemo(() => {
    if (!ownerId) return properties;
    const oid = parseInt(ownerId, 10);
    return properties.filter((p) => p.owner?.id === oid || p.owner_id === oid);
  }, [properties, ownerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        number,
        owner_id: Number(ownerId),
        property_id: propertyId ? Number(propertyId) : null,
      };

      if (isEdit) {
        await updateGarage(garage.id, payload);
        setFeedback({
          variant: "success",
          title: "Garage actualizado",
          message: "El garage se actualizó correctamente.",
        });
      } else {
        await createGarage(payload);
        resetForm();
        setFeedback({
          variant: "success",
          title: "Garage creado",
          message: "El garage se creó correctamente.",
        });
      }
    } catch (err) {
      console.error("Error guardando garage:", err);
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || (isEdit ? "Error al actualizar el garage." : "Error al crear el garage."),
      });
    }
  };

  const closeFeedback = () => {
    const variant = feedback?.variant;
    setFeedback(null);
    if (variant !== "danger") {
      onCreated?.();
      onHide();
    }
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        if (feedback) {
          closeFeedback();
          return;
        }
        resetForm();
        onHide();
      }}
      backdrop="static"
    >
      {feedback ? (
        <FeedbackView
          variant={feedback.variant}
          title={feedback.title}
          message={feedback.message}
          onClose={closeFeedback}
        />
      ) : (
      <>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? "Editar garage" : "Crear Garage"}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
              {error && <div className="alert alert-danger">{error}</div>}
              <Form.Group className="mb-3">
                <Form.Label>Número</Form.Label>
                <Form.Control
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Dueño</Form.Label>
                <Form.Select
                  value={ownerId}
                  onChange={(e) => {
                    setOwnerId(e.target.value);
                    setPropertyId("");
                  }}
                  required
                >
                  <option value="">Seleccione dueño</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.email ? `— ${o.email}` : ""}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Propiedad (opcional)</Form.Label>
                <Form.Select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                >
                  <option value="">Sin propiedad (solo garage)</option>
                  {ownerProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.direction}
                      {p.floor ? ` · Piso ${p.floor}` : ""}
                      {p.apartment ? ` · Depto ${p.apartment}` : ""}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Si lo asociás a una propiedad, igual podés alquilarlo por separado después.
                </Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              resetForm();
              onHide();
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!number || !ownerId}>
            Guardar
          </Button>
        </Modal.Footer>
      </Form>
      </>
      )}
    </Modal>
  );
};

export default CreateGarageModal;
