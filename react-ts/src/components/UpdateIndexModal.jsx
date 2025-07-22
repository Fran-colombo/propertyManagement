import { useState, useEffect } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import { getIndexes, updateIndex } from "../api/index";

const UpdateIndexModal = ({ show, onHide }) => {
  const [indexes, setIndexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (show) {
      loadIndexes();
    }
  }, [show]);

  const loadIndexes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getIndexes();
      setIndexes(data);
      if (data.length > 0) {
        setSelectedIndex(data[0].type);
        setNewValue(data[0].value.toString());
      }
    } catch (err) {
      console.error("Error loading indexes:", err);
      setError("Error al cargar los índices");
    } finally {
      setLoading(false);
    }
  };

  const handleIndexChange = (e) => {
    const type = e.target.value;
    setSelectedIndex(type);
    const index = indexes.find(i => i.type === type);
    setNewValue(index.value.toString());
  };

  const handleSubmit = async () => {
    if (!selectedIndex || !newValue) return;
    
    try {
      setUpdating(true);
      setError(null);
      
      await updateIndex({ 
        type: selectedIndex, 
        value: parseFloat(newValue) 
      });
      
      onHide(); // Cerrar el modal
    } catch (err) {
      console.error("Error updating index:", err);
      setError("Error al actualizar el índice");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Actualizar Índice</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        {loading ? (
          <div className="text-center">
            <Spinner animation="border" />
            <p>Cargando índices...</p>
          </div>
        ) : (
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Seleccione el índice</Form.Label>
              <Form.Select 
                value={selectedIndex || ""}
                onChange={handleIndexChange}
                disabled={updating}
              >
                {indexes.map(index => (
                  <option key={index.type} value={index.type}>
                    {index.type.replace(/_/g, ' ')}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nuevo valor</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                disabled={updating}
              />
              {selectedIndex && (
                <Form.Text className="text-muted">
                  Valor actual: {indexes.find(i => i.type === selectedIndex)?.value}
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
          disabled={updating || !selectedIndex || !newValue}
        >
          {updating ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> Actualizando...
            </>
          ) : 'Actualizar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UpdateIndexModal;