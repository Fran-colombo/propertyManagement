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
    reference: "",
  });
  const [overpayOpen, setOverpayOpen] = useState(false);
  const [overpayReason, setOverpayReason] = useState("");
  const [overpayNote, setOverpayNote] = useState("");
  const [overpayError, setOverpayError] = useState("");

  useEffect(() => {
    setPaymentData({
      amount: Math.max(0, (period?.total_amount || 0) - (period?.amount_paid || 0)),
      method: "transferencia",
      reference: "",
    });
    setOverpayOpen(false);
    setOverpayReason("");
    setOverpayNote("");
    setOverpayError("");
  }, [period, show]);

  const extra = round2((paymentData.amount || 0) - remaining);
  const isOverpay = extra > 0.009;

  const submitPayment = (payload) => {
    onPay(period.id, payload);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isOverpay) {
      setOverpayOpen(true);
      return;
    }
    submitPayment(paymentData);
  };

  const confirmOverpay = () => {
    if (!overpayReason) {
      setOverpayError("Elegí el motivo del pago de más.");
      return;
    }
    if (overpayReason === "otro" && !overpayNote.trim()) {
      setOverpayError("Especificá por qué se pagó de más.");
      return;
    }
    setOverpayError("");
    submitPayment({
      ...paymentData,
      overpay_reason: overpayReason,
      overpay_note: overpayNote.trim() || undefined,
    });
    setOverpayOpen(false);
  };

  const periodRent = period?.period_rent ?? period?.indexed_amount;
  const fullRent = period?.indexed_amount;

  return (
    <>
    <Modal show={show && !overpayOpen} onHide={onHide}>
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
            <Form.Label>Nota / referencia</Form.Label>
            <Form.Control
              type="text"
              value={paymentData.reference}
              onChange={(e) => setPaymentData({
                ...paymentData,
                reference: e.target.value
              })}
              placeholder="Comprobante, observación..."
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

    <Modal show={overpayOpen} onHide={() => setOverpayOpen(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Se está pagando de más</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="warning" className="small">
          Saldo del período: ${Number(remaining).toLocaleString()}
          <br />
          Monto cargado: ${Number(paymentData.amount || 0).toLocaleString()}
          <br />
          Excedente: <strong>${Number(extra).toLocaleString()}</strong>
        </Alert>
        <p className="mb-2">¿Cuál es el motivo?</p>
        {overpayError && <Alert variant="danger" className="py-2">{overpayError}</Alert>}
        <Form.Check
          type="radio"
          id="overpay-adelanto"
          name="overpayReason"
          label="Adelanto: se cubre este mes y el resto va al mes siguiente"
          checked={overpayReason === "adelanto"}
          onChange={() => setOverpayReason("adelanto")}
          className="mb-2"
        />
        <Form.Check
          type="radio"
          id="overpay-otro"
          name="overpayReason"
          label="Otro (especificar)"
          checked={overpayReason === "otro"}
          onChange={() => setOverpayReason("otro")}
          className="mb-2"
        />
        {overpayReason === "otro" && (
          <Form.Control
            as="textarea"
            rows={3}
            className="mt-2"
            placeholder="¿Por qué se pagó de más?"
            value={overpayNote}
            onChange={(e) => setOverpayNote(e.target.value)}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={() => setOverpayOpen(false)}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmOverpay}>
          Confirmar
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
