import { useState } from "react";
import { Modal, Form, Button } from "react-bootstrap";

export default function PayPeriodModal({ show, onHide, period, onPay }) {
  const [paymentData, setPaymentData] = useState({
    amount: period?.total_amount - (period?.amount_paid || 0),
    method: "transferencia",
    reference: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onPay(period.id, paymentData);
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Registrar Pago</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Monto a Pagar</Form.Label>
            <Form.Control
              type="number"
              value={paymentData.amount}
              onChange={(e) => setPaymentData({
                ...paymentData,
                amount: parseFloat(e.target.value)
              })}
              min="0.01"
              step="0.01"
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Método de Pago</Form.Label>
            <Form.Select
              value={paymentData.method}
              onChange={(e) => setPaymentData({
                ...paymentData,
                method: e.target.value
              })}
              required
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Referencia/Comprobante</Form.Label>
            <Form.Control
              type="text"
              value={paymentData.reference}
              onChange={(e) => setPaymentData({
                ...paymentData,
                reference: e.target.value
              })}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            Registrar Pago
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}