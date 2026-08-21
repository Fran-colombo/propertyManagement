import { useEffect, useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";

export default function PayPeriodModal({ show, onHide, period, onPay }) {
  const remaining = Math.max(
    0,
    (period?.total_amount || 0) - (period?.amount_paid || 0)
  );
  const [paymentData, setPaymentData] = useState({
    amount: remaining,
    method: "transferencia",
    reference: ""
  });

  useEffect(() => {
    setPaymentData({
      amount: Math.max(0, (period?.total_amount || 0) - (period?.amount_paid || 0)),
      method: "transferencia",
      reference: ""
    });
  }, [period, show]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onPay(period.id, paymentData);
  };

  const periodRent = period?.period_rent ?? period?.indexed_amount;
  const fullRent = period?.indexed_amount;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Registrar Pago</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {period?.is_prorated && (
            <Alert variant="info" className="small">
              <strong>Alquiler proporcional.</strong>{" "}
              {period.proration_note || "Este mes no se ocupa completo."}
              <div className="mt-2">
                Alquiler mensual: ${Number(fullRent || 0).toLocaleString()}
                <br />
                Este período: ${Number(periodRent || 0).toLocaleString()}
                <br />
                Total a pagar: ${Number(period?.total_amount || 0).toLocaleString()}
              </div>
              Si pagás ese total, queda <strong>PAGADO</strong> (no es un pago parcial).
            </Alert>
          )}
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
            <Form.Text className="text-muted">
              Saldo de este período: ${Number(remaining).toLocaleString()}
            </Form.Text>
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
