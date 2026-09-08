import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { getProperties } from "../api/property";
import { getPropertyIncome } from "../api/report";
import SearchableSelect from "../components/SearchableSelect";

function propertyLabel(p) {
  const parts = [p.direction];
  if (p.floor) parts.push(`Piso ${p.floor}`);
  if (p.apartment) parts.push(`Depto ${p.apartment}`);
  return parts.join(" · ");
}

function money(amount, currency) {
  const n = Number(amount) || 0;
  const prefix = currency === "DOLARES" ? "U$S" : "$";
  return `${prefix} ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartIso() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function IncomeReport() {
  const [properties, setProperties] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState(yearStartIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [loadingProps, setLoadingProps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    getProperties()
      .then((list) => setProperties(list || []))
      .catch(() => {
        setProperties([]);
        setError("No se pudieron cargar las propiedades.");
      })
      .finally(() => setLoadingProps(false));
  }, []);

  const options = useMemo(
    () =>
      properties.map((p) => ({
        value: p.id,
        label: propertyLabel(p),
        search: `${p.direction} ${p.floor || ""} ${p.apartment || ""} ${p.owner?.name || ""}`,
      })),
    [properties]
  );

  const loadReport = async () => {
    if (!selectedIds.length) {
      setError("Seleccioná al menos una propiedad.");
      setReport(null);
      return;
    }
    if (!startDate || !endDate) {
      setError("Completá el rango de fechas.");
      setReport(null);
      return;
    }
    if (startDate > endDate) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.");
      setReport(null);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await getPropertyIncome({
        propertyIds: selectedIds,
        startDate,
        endDate,
      });
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err.message || "No se pudo generar el informe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="h4">Ingresos por propiedades</h2>
      <p className="text-muted small">
        Facturado son los alquileres de períodos que se solapan con el rango.
        Cobrado son los pagos registrados entre esas fechas (sin cargas iniciales
        ni ventas). Un cobro de un mes anterior en este rango cuenta como cobrado,
        no como facturado de esos meses.
      </p>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col xs={12} lg={6}>
          <Form.Label>Propiedades</Form.Label>
          {loadingProps ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <SearchableSelect
              multiple
              options={options}
              value={selectedIds}
              onChange={(vals) => setSelectedIds((vals || []).map(Number))}
              placeholder="Buscar y agregar propiedades..."
              emptyText="No hay propiedades que coincidan."
            />
          )}
          <div className="d-flex flex-wrap gap-2 mt-2">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setSelectedIds(properties.map((p) => p.id))}
              disabled={!properties.length}
            >
              Seleccionar todas
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setSelectedIds([])}
              disabled={!selectedIds.length}
            >
              Quitar todas
            </Button>
          </div>
        </Col>
        <Col xs={12} sm={6} lg={2}>
          <Form.Label>Desde</Form.Label>
          <Form.Control
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Col>
        <Col xs={12} sm={6} lg={2}>
          <Form.Label>Hasta</Form.Label>
          <Form.Control
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Col>
        <Col xs={12} lg={2} className="d-flex align-items-end">
          <Button onClick={loadReport} disabled={loading || loadingProps}>
            {loading ? "Calculando..." : "Ver informe"}
          </Button>
        </Col>
      </Row>

      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      )}

      {!loading && report && (
        <div className="table-responsive">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>Facturado $</th>
                <th>Facturado USD</th>
                <th>Cobrado $</th>
                <th>Cobrado USD</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.property_id}>
                  <td>{propertyLabel(item)}</td>
                  <td>{money(item.billed_pesos, "PESOS")}</td>
                  <td>{money(item.billed_dolares, "DOLARES")}</td>
                  <td>{money(item.collected_pesos, "PESOS")}</td>
                  <td>{money(item.collected_dolares, "DOLARES")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td>Total</td>
                <td>{money(report.totals.billed_pesos, "PESOS")}</td>
                <td>{money(report.totals.billed_dolares, "DOLARES")}</td>
                <td>{money(report.totals.collected_pesos, "PESOS")}</td>
                <td>{money(report.totals.collected_dolares, "DOLARES")}</td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
    </div>
  );
}
