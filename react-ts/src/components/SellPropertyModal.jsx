import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Row, Col, Spinner } from "react-bootstrap";
import { getOwners, createOwner } from "../api/person";
import { sellProperty } from "../api/sale";

function todayISO() {
  const t = new Date();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${t.getFullYear()}-${m}-${d}`;
}

function addMonthsISO(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export default function SellPropertyModal({ show, onHide, property, onSold }) {
  const [owners, setOwners] = useState([]);
  const [keepManaging, setKeepManaging] = useState(true);
  const [buyerOwnerId, setBuyerOwnerId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [newBuyer, setNewBuyer] = useState({ name: "", phone: "", email: "" });
  const [creatingBuyer, setCreatingBuyer] = useState(false);
  const [saleDate, setSaleDate] = useState(todayISO());
  const [currency, setCurrency] = useState("PESOS");
  const [totalAmount, setTotalAmount] = useState("");
  const [mode, setMode] = useState("contado");
  const [paidNow, setPaidNow] = useState(true);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(todayISO());
  const [advancePaid, setAdvancePaid] = useState(false);
  const [cuotaCount, setCuotaCount] = useState("12");
  const [installments, setInstallments] = useState([]);
  const [method, setMethod] = useState("transferencia");
  const [receivedBy, setReceivedBy] = useState("DUENO");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setKeepManaging(true);
    setBuyerOwnerId("");
    setBuyerName("");
    setNewBuyer({ name: "", phone: "", email: "" });
    setCreatingBuyer(false);
    setSaleDate(todayISO());
    setCurrency("PESOS");
    setTotalAmount("");
    setMode("contado");
    setPaidNow(true);
    setAdvanceAmount("");
    setAdvanceDate(todayISO());
    setAdvancePaid(false);
    setCuotaCount("12");
    setInstallments([]);
    setMethod("transferencia");
    setReceivedBy("DUENO");
    setNotes("");
    setError("");
    setSaving(false);
    getOwners()
      .then((list) => setOwners(list || []))
      .catch(() => setOwners([]));
  }, [show, property?.id]);

  const installmentSum = useMemo(
    () => round2(installments.reduce((acc, row) => acc + (Number(row.amount) || 0), 0)),
    [installments]
  );
  const total = round2(totalAmount);
  const advance = round2(advanceAmount);
  const financed = Math.max(0, round2(total - advance));

  useEffect(() => {
    if (mode !== "cuotas") return;
    setAdvanceDate((prev) => prev || saleDate);
  }, [mode, saleDate]);

  const handleCreateBuyer = async () => {
    if (!newBuyer.name.trim()) {
      setError("El comprador necesita un nombre.");
      return;
    }
    setCreatingBuyer(true);
    setError("");
    try {
      const created = await createOwner({
        name: newBuyer.name.trim(),
        phone: newBuyer.phone || "",
        email: newBuyer.email || "",
      });
      setOwners((prev) => [...prev, created]);
      setBuyerOwnerId(String(created.id));
      setNewBuyer({ name: "", phone: "", email: "" });
    } catch (err) {
      setError(err.message || "No se pudo crear el dueño.");
    } finally {
      setCreatingBuyer(false);
    }
  };

  const buildInstallments = () => {
    if (mode === "contado") {
      return [
        {
          due_date: saleDate,
          amount: total,
          paid: paidNow,
          kind: "cuota",
        },
      ];
    }
    const rows = [];
    if (advance > 0.009) {
      rows.push({
        due_date: advanceDate || saleDate,
        amount: advance,
        paid: !!advancePaid,
        kind: "adelanto",
      });
    }
    installments
      .filter((row) => row.due_date && Number(row.amount) > 0)
      .forEach((row) => {
        rows.push({
          due_date: row.due_date,
          amount: round2(row.amount),
          paid: !!row.paid,
          kind: "cuota",
        });
      });
    return rows;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!property?.id) return;
    if (!total || total <= 0) {
      setError("Indicá el monto de la venta.");
      return;
    }
    const rows = buildInstallments();
    if (!rows.length) {
      setError("Indicá las cuotas.");
      return;
    }
    const sum = round2(rows.reduce((acc, row) => acc + row.amount, 0));
    if (advance > total + 0.009) {
      setError("El adelanto no puede ser mayor al total.");
      return;
    }
    if (Math.abs(sum - total) > 0.05) {
      setError(`El adelanto más las cuotas suman ${sum} y el total es ${total}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await sellProperty(property.id, {
        keep_managing: keepManaging,
        buyer_owner_id: keepManaging ? Number(buyerOwnerId) : null,
        buyer_name: keepManaging ? undefined : buyerName.trim(),
        sale_date: saleDate,
        currency,
        total_amount: total,
        notes: notes.trim() || null,
        installments: rows,
        payment_method: method,
        received_by: receivedBy,
      });
      if (onSold) onSold();
      onHide();
    } catch (err) {
      setError(err.message || "No se pudo registrar la venta.");
    } finally {
      setSaving(false);
    }
  };

  const splitEven = (count) => {
    if (financed <= 0.009) {
      setError("Indicá un total mayor al adelanto para generar cuotas.");
      setInstallments([]);
      return;
    }
    const n = Math.max(1, Number(count) || 1);
    setCuotaCount(String(n));
    const base = round2(financed / n);
    const rows = [];
    let acc = 0;
    for (let i = 0; i < n; i += 1) {
      const amount = i === n - 1 ? round2(financed - acc) : base;
      acc = round2(acc + amount);
      rows.push({
        due_date: addMonthsISO(saleDate, i),
        amount: String(amount),
        paid: false,
      });
    }
    setInstallments(rows);
    setError("");
  };

  const moneyLabel = (amount) => {
    const prefix = currency === "DOLARES" ? "U$S" : "$";
    return `${prefix} ${Number(amount || 0).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Vender propiedad</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-muted">
            {property?.direction}
            {property?.owner?.name ? ` · Dueño actual: ${property.owner.name}` : ""}
          </p>
          <Form.Check
            type="switch"
            id="keep-managing"
            className="mb-3"
            checked={keepManaging}
            onChange={(e) => setKeepManaging(e.target.checked)}
            label="Sigo administrando (el comprador queda como dueño)"
          />
          {keepManaging ? (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Comprador (dueño)</Form.Label>
                <Form.Select
                  value={buyerOwnerId}
                  onChange={(e) => setBuyerOwnerId(e.target.value)}
                  required
                >
                  <option value="">Elegí un dueño</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Si hay contrato vigente, seguís cobrando el alquiler para este dueño.
                  Si está vacía, queda entregada.
                </Form.Text>
              </Form.Group>
              <Alert variant="secondary" className="py-2">
                <div className="fw-semibold mb-2">O crear dueño ahora</div>
                <Row className="g-2">
                  <Col md={4}>
                    <Form.Control
                      placeholder="Nombre"
                      value={newBuyer.name}
                      onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      placeholder="Teléfono"
                      value={newBuyer.phone}
                      onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      placeholder="Email"
                      value={newBuyer.email}
                      onChange={(e) => setNewBuyer({ ...newBuyer, email: e.target.value })}
                    />
                  </Col>
                  <Col md={2}>
                    <Button
                      type="button"
                      variant="outline-primary"
                      disabled={creatingBuyer}
                      onClick={handleCreateBuyer}
                    >
                      {creatingBuyer ? <Spinner size="sm" /> : "Alta"}
                    </Button>
                  </Col>
                </Row>
              </Alert>
            </>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>Nombre del comprador</Form.Label>
              <Form.Control
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                Dejás de administrar: se da de baja el contrato si hay, y la propiedad
                sale de la lista activa.
              </Form.Text>
            </Form.Group>
          )}
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Fecha de venta</Form.Label>
                <Form.Control
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Moneda</Form.Label>
                <Form.Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="PESOS">Pesos</option>
                  <option value="DOLARES">Dólares</option>
                </Form.Select>
                <Form.Text className="text-muted">No se mezcla con la otra moneda.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Monto total</Form.Label>
                <Form.Control
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>Forma de cobro</Form.Label>
            <Form.Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="contado">Contado (un pago)</option>
              <option value="cuotas">En cuotas</option>
            </Form.Select>
          </Form.Group>
          {mode === "contado" ? (
            <Form.Check
              className="mb-3"
              type="checkbox"
              id="paid-now"
              checked={paidNow}
              onChange={(e) => setPaidNow(e.target.checked)}
              label="Ya está cobrado"
            />
          ) : (
            <div className="mb-3">
              <div className="border rounded p-3 mb-3">
                <div className="fw-semibold mb-2">Adelanto pactado (opcional)</div>
                <p className="small text-muted mb-2">
                  No es una cuota. Se resta del total y el resto se parte en cuotas iguales.
                </p>
                <Row className="g-2 align-items-end">
                  <Col md={4}>
                    <Form.Label>Monto</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Fecha</Form.Label>
                    <Form.Control
                      type="date"
                      value={advanceDate}
                      onChange={(e) => setAdvanceDate(e.target.value)}
                    />
                  </Col>
                  <Col md={4} className="d-flex align-items-center pb-2">
                    <Form.Check
                      type="checkbox"
                      id="advance-paid"
                      checked={advancePaid}
                      onChange={(e) => setAdvancePaid(e.target.checked)}
                      label="Ya está cobrado"
                    />
                  </Col>
                </Row>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-end mb-2">
                <Form.Group>
                  <Form.Label className="mb-1">Cantidad de cuotas iguales</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    step="1"
                    style={{ width: 90 }}
                    value={cuotaCount}
                    onChange={(e) => setCuotaCount(e.target.value)}
                  />
                </Form.Group>
                <Button type="button" size="sm" variant="primary" onClick={() => splitEven(cuotaCount)}>
                  Generar
                </Button>
                <Button type="button" size="sm" variant="outline-secondary" onClick={() => splitEven(12)}>
                  12
                </Button>
                <Button type="button" size="sm" variant="outline-secondary" onClick={() => splitEven(24)}>
                  24
                </Button>
                <Button type="button" size="sm" variant="outline-secondary" onClick={() => splitEven(36)}>
                  36
                </Button>
              </div>
              <div className="small text-muted mb-2">
                {advance > 0.009
                  ? `Adelanto ${moneyLabel(advance)} + ${installments.length || Number(cuotaCount) || 0} cuotas de ~${moneyLabel(financed / Math.max(1, installments.length || Number(cuotaCount) || 1))} (saldo ${moneyLabel(financed)}).`
                  : `${installments.length || Number(cuotaCount) || 0} cuotas de ~${moneyLabel(financed / Math.max(1, installments.length || Number(cuotaCount) || 1))}.`}
                {" "}Suma cuotas: {moneyLabel(installmentSum)}.
              </div>
              {installments.map((row, index) => (
                <Row key={index} className="g-2 mb-2">
                  <Col md={4}>
                    <Form.Control
                      type="date"
                      value={row.due_date}
                      onChange={(e) => {
                        const next = [...installments];
                        next[index] = { ...row, due_date: e.target.value };
                        setInstallments(next);
                      }}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Monto"
                      value={row.amount}
                      onChange={(e) => {
                        const next = [...installments];
                        next[index] = { ...row, amount: e.target.value };
                        setInstallments(next);
                      }}
                    />
                  </Col>
                  <Col md={3} className="d-flex align-items-center">
                    <Form.Check
                      type="checkbox"
                      id={`inst-paid-${index}`}
                      checked={!!row.paid}
                      onChange={(e) => {
                        const next = [...installments];
                        next[index] = { ...row, paid: e.target.checked };
                        setInstallments(next);
                      }}
                      label="Cobrada"
                    />
                  </Col>
                  <Col md={1}>
                    <Button
                      type="button"
                      variant="outline-danger"
                      size="sm"
                      onClick={() => setInstallments(installments.filter((_, i) => i !== index))}
                    >
                      x
                    </Button>
                  </Col>
                </Row>
              ))}
            </div>
          )}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Método (si hay cobro ahora)</Form.Label>
                <Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>¿Quién cobró?</Form.Label>
                <Form.Select value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}>
                  <option value="DUENO">El dueño vendedor</option>
                  <option value="INTERMEDIARIO">Yo / intermediario (después se lo paso)</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group>
            <Form.Label>Notas</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : "Registrar venta"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
