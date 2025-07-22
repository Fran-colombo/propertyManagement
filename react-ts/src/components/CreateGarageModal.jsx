// import { useState } from "react";
// import { Modal, Button, Form } from "react-bootstrap";
// import { createGarage } from "../api/garage"; 

// const CreateGarageModal = ({ show, onHide, onCreated }) => {
//   const [number, setNumber] = useState("");
//   const [ownerId, setOwnerId] = useState("");
//   const [propertyId, setPropertyId] = useState("");

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     try {
//       const payload = {
//         number,
//         owner_id: Number(ownerId),
//         property_id: propertyId ? Number(propertyId) : null,
//       };

//       await createGarage(payload);
//       onCreated();      
//       onHide();         
//     } catch (err) {
//       console.error("Error creando garage:", err);
//       alert("Error al crear el garage.");
//     }
//   };

//   const resetForm = () => {
//     setNumber("");
//     setOwnerId("");
//     setPropertyId("");
//   };

//   return (
//     <Modal show={show} onHide={() => { resetForm(); onHide(); }}>
//       <Modal.Header closeButton>
//         <Modal.Title>Crear Garage</Modal.Title>
//       </Modal.Header>
//       <Form onSubmit={handleSubmit}>
//         <Modal.Body>
//           <Form.Group className="mb-3">
//             <Form.Label>Número</Form.Label>
//             <Form.Control
//               type="text"
//               value={number}
//               onChange={(e) => setNumber(e.target.value)}
//               required
//             />
//           </Form.Group>

//           <Form.Group className="mb-3">
//             <Form.Label>ID del Dueño</Form.Label>
//             <Form.Control
//               type="number"
//               value={ownerId}
//               onChange={(e) => setOwnerId(e.target.value)}
//               required
//             />
//           </Form.Group>

//           <Form.Group className="mb-3">
//             <Form.Label>ID de Propiedad (opcional)</Form.Label>
//             <Form.Control
//               type="number"
//               value={propertyId}
//               onChange={(e) => setPropertyId(e.target.value)}
//               placeholder="Dejar vacío si no tiene propiedad"
//             />
//           </Form.Group>
//         </Modal.Body>

//         <Modal.Footer>
//           <Button variant="secondary" onClick={() => { resetForm(); onHide(); }}>
//             Cancelar
//           </Button>
//           <Button type="submit" variant="primary">
//             Crear
//           </Button>
//         </Modal.Footer>
//       </Form>
//     </Modal>
//   );
// };

// export default CreateGarageModal;


import { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { createGarage } from "../api/garage";
import { getProperties } from "../api/property";
import { getOwners } from "../api/person"; // Asegurate de tener este endpoint

const CreateGarageModal = ({ show, onHide, onCreated }) => {
  const [number, setNumber] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const resetForm = () => {
    setNumber("");
    setOwnerId("");
    setPropertyId("");
  };

  useEffect(() => {
    if (show) {
      loadData();
    }
  }, [show]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ownersData, propsData] = await Promise.all([
        getOwners(),
        getProperties(),
      ]);
      setOwners(ownersData || []);
      setProperties((propsData || []).filter((p) => p.rental_contract === null));
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        number,
        owner_id: Number(ownerId),
        property_id: propertyId ? Number(propertyId) : null,
      };

      await createGarage(payload);
      onCreated();
      onHide();
      resetForm();
    } catch (err) {
      console.error("Error creando garage:", err);
      alert("Error al crear el garage.");
    }
  };

  return (
    <Modal show={show} onHide={() => { resetForm(); onHide(); }}>
      <Modal.Header closeButton>
        <Modal.Title>Crear Garage</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
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
                  onChange={(e) => setOwnerId(e.target.value)}
                  required
                >
                  <option value="">Seleccione dueño</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} - {o.dni}
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
                  <option value="">Sin propiedad</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.direction} - {p.apartment} - {p.floor} - {p.owner.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { resetForm(); onHide(); }}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!number || !ownerId}>
            Crear
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CreateGarageModal;
