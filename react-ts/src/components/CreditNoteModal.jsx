import { useEffect, useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";

export default function CreditNoteModal({ show, onHide, transaction, onSave }) {
  const paid = Number(transaction?.period?.amount_paid || 0);
  const defaultAmount = Math.min(Number(transaction?.amount || 0), paid);
  const [amount, setAmount] = useState(defaultAmount);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount(Math.min(Number(transaction?.amount || 0), Number(transaction?.period?.amount_paid || 0)));
    setNotes("");
    setError("");
  }, [transaction, show]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Indicá por qué se carga la nota de crédito (ej. se cargó por error).");
      return;
    }
    if (amount <= 0 || amount > paid + 0.009) {
      setError("El monto no puede superar lo pagado en el período.");
      return;
    }
    onSave(transaction.period.id, {
      amount,
      notes: notes.trim(),
      received_by: transaction.received_by,
      remitted_to_owner: Boolean(transaction.remitted_to_owner),
    });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Nota de crédito</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="small">
            Resta del pagado de este período. El pago original no se borra.
            Pagado actual: ${paid.toLocaleString()}
          </Alert>
          {error && <Alert variant="danger" className="py-2">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Monto a revertir</Form.Label>
            <Form.Control
              type="number"
              min="0.01"
              step="0.01"
              max={paid}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              required
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Motivo</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Se cargó tal cosa por error..."
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit">
            Registrar crédito
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
