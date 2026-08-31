import { useEffect, useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";
import FeedbackModal from "./FeedbackModal";

function parseISODate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const DEFAULT_DAILY_RATE = 2.5;

export default function PayPeriodModal({ show, onHide, period, onPay }) {
  const dueDate = parseISODate(period?.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysOverdue =
    dueDate && dueDate < today
      ? Math.round((today - dueDate) / 86400000)
      : 0;
  const existingFee = Number(period?.late_fee_amount || 0);
  const remainingNow = Math.max(
    0,
    (period?.total_amount || 0) - (period?.amount_paid || 0)
  );
  const unpaidPrincipal = Math.max(0, remainingNow - existingFee);

  const [paymentData, setPaymentData] = useState({
    amount: remainingNow,
    method: "transferencia",
    reference: "",
    received_by: "INTERMEDIARIO",
  });
  const [overpayOpen, setOverpayOpen] = useState(false);
  const [overpayReason, setOverpayReason] = useState("");
  const [overpayNote, setOverpayNote] = useState("");
  const [overpayError, setOverpayError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [chargeLateFee, setChargeLateFee] = useState(false);
  const [feeMode, setFeeMode] = useState("daily");
  const [dailyRate, setDailyRate] = useState(DEFAULT_DAILY_RATE);
  const [customFee, setCustomFee] = useState("");

  const dailyFee = round2(
    unpaidPrincipal * (Number(dailyRate) || 0) / 100 * daysOverdue
  );
  const selectedFee = chargeLateFee
    ? feeMode === "custom"
      ? round2(Number(customFee) || 0)
      : dailyFee
    : existingFee;
  const remainingAfterFee = chargeLateFee
    ? round2(unpaidPrincipal + selectedFee)
    : remainingNow;

  useEffect(() => {
    setPaymentData({
      amount: remainingNow,
      method: "transferencia",
      reference: "",
      received_by: "INTERMEDIARIO",
    });
    setOverpayOpen(false);
    setOverpayReason("");
    setOverpayNote("");
    setOverpayError("");
    setFeedback(null);
    setSaving(false);
    setChargeLateFee(false);
    setFeeMode("daily");
    setDailyRate(DEFAULT_DAILY_RATE);
    setCustomFee("");
  }, [period, show]);

  useEffect(() => {
    if (!show) return;
    setPaymentData((prev) => ({ ...prev, amount: remainingAfterFee }));
  }, [show, chargeLateFee, feeMode, dailyRate, customFee, remainingAfterFee]);

  const extra = round2((paymentData.amount || 0) - remainingAfterFee);
  const isOverpay = extra > 0.009;

  const submitPayment = async (payload) => {
    setSaving(true);
    try {
      await onPay(period.id, payload);
      setOverpayOpen(false);
      setFeedback({
        variant: "success",
        title: "Pago registrado",
        message: "El pago se registró correctamente.",
      });
    } catch (err) {
      setOverpayOpen(false);
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "Error al registrar el pago.",
      });
    } finally {
      setSaving(false);
    }
  };

  const buildPayload = (base) => {
    const payload = { ...base };
    if (chargeLateFee && daysOverdue > 0) {
      payload.apply_late_fee = true;
      payload.late_fee_mode = feeMode;
      payload.late_fee_daily_rate = Number(dailyRate) || DEFAULT_DAILY_RATE;
      if (feeMode === "custom") {
        payload.late_fee_amount = round2(Number(customFee) || 0);
      }
    }
    return payload;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isOverpay) {
      setOverpayOpen(true);
      return;
    }
    submitPayment(buildPayload(paymentData));
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
    submitPayment(
      buildPayload({
        ...paymentData,
        overpay_reason: overpayReason,
        overpay_note: overpayNote.trim() || undefined,
      })
    );
    setOverpayOpen(false);
  };

  const periodRent = period?.period_rent ?? period?.indexed_amount;
  const fullRent = period?.indexed_amount;
  const dueLabel = dueDate
    ? dueDate.toLocaleDateString("es-AR")
    : "—";

  return (
    <>
    <Modal show={show && !overpayOpen && !feedback} onHide={onHide}>
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
                Alquiler mensual: ${money(fullRent)}
                <br />
                Este período: ${money(periodRent)}
                <br />
                Total a pagar: ${money(period?.total_amount)}
              </div>
              Si pagás ese total, queda <strong>PAGADO</strong> (no es un pago parcial).
            </Alert>
          )}
          <p className="small text-muted mb-3">
            Vencimiento: <strong>{dueLabel}</strong>
            {daysOverdue > 0 && (
              <> · {daysOverdue} día{daysOverdue === 1 ? "" : "s"} de atraso</>
            )}
          </p>
          {daysOverdue > 0 && (
            <Alert variant="warning" className="small">
              <Form.Check
                type="checkbox"
                id="charge-late-fee"
                label="Cobrar recargo por atraso"
                checked={chargeLateFee}
                onChange={(e) => setChargeLateFee(e.target.checked)}
              />
              <Form.Text className="text-muted d-block mb-2">
                Por defecto no se cobra. Si lo marcás, podés usar 2,5% por día o un monto fijo.
              </Form.Text>
              {chargeLateFee && (
                <>
                  <Form.Check
                    type="radio"
                    id="fee-daily"
                    name="feeMode"
                    className="mb-2"
                    label={`2,5% por día (${daysOverdue} × ${String(dailyRate).replace(".", ",")} % × $${money(unpaidPrincipal)} = $${money(dailyFee)})`}
                    checked={feeMode === "daily"}
                    onChange={() => setFeeMode("daily")}
                  />
                  {feeMode === "daily" && (
                    <Form.Group className="mb-2 ms-4">
                      <Form.Label className="small mb-1">% por día</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.1"
                        value={dailyRate}
                        onChange={(e) => setDailyRate(e.target.value)}
                        style={{ maxWidth: 120 }}
                      />
                    </Form.Group>
                  )}
                  <Form.Check
                    type="radio"
                    id="fee-custom"
                    name="feeMode"
                    className="mb-2"
                    label="Otro monto (lo estipulo yo)"
                    checked={feeMode === "custom"}
                    onChange={() => setFeeMode("custom")}
                  />
                  {feeMode === "custom" && (
                    <Form.Group className="mb-2 ms-4">
                      <Form.Label className="small mb-1">Recargo</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={customFee}
                        onChange={(e) => setCustomFee(e.target.value)}
                        placeholder="Monto del recargo"
                      />
                    </Form.Group>
                  )}
                  <div>
                    Recargo: <strong>${money(selectedFee)}</strong>
                    {" · "}
                    Total a cobrar: <strong>${money(remainingAfterFee)}</strong>
                  </div>
                </>
              )}
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
              Saldo de este período: ${money(remainingAfterFee)}
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
            <Form.Label>¿Quién cobró?</Form.Label>
            <Form.Select
              value={paymentData.received_by}
              onChange={(e) => setPaymentData({
                ...paymentData,
                received_by: e.target.value
              })}
              required
            >
              <option value="INTERMEDIARIO">Yo / intermediario (después se lo paso al dueño)</option>
              <option value="DUENO">El dueño (le pagaron directo)</option>
            </Form.Select>
            <Form.Text className="text-muted">
              El método es cómo pagó el inquilino. Esto es quién tiene la plata.
            </Form.Text>
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
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Registrar Pago"}
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
          Saldo del período: ${money(remainingAfterFee)}
          <br />
          Monto cargado: ${money(paymentData.amount)}
          <br />
          Excedente: <strong>${money(extra)}</strong>
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
        <Button variant="outline-secondary" onClick={() => setOverpayOpen(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmOverpay} disabled={saving}>
          {saving ? "Guardando..." : "Confirmar"}
        </Button>
      </Modal.Footer>
    </Modal>
    <FeedbackModal
      show={!!feedback}
      variant={feedback?.variant}
      title={feedback?.title}
      message={feedback?.message}
      onClose={() => {
        const variant = feedback?.variant;
        setFeedback(null);
        if (variant !== "danger") {
          onHide();
        }
      }}
    />
    </>
  );
}
