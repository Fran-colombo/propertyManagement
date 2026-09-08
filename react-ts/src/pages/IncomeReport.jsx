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

function csvDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

function lineStatus(line) {
  if (line.kind === "vacant") return "No factura: no está ocupado";
  if (line.kind === "settlement") return line.note || "Acuerdo de baja";
  return line.payment_status || "—";
}

function exportReportTable(report) {
  if (!report) return;
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const moneyCell = (amount, currency) => esc(money(amount, currency));
  const detailRows = (report.billed_lines || [])
    .map((line) => {
      const vacant = line.kind === "vacant";
      const note = vacant
        ? "No factura: no está ocupado"
        : line.note || "—";
      return `<tr${vacant ? ' class="vacant"' : ""}>
        <td>${esc(propertyLabel(line))}</td>
        <td>${esc(line.tenant_name || (vacant ? "—" : "Sin inquilino"))}</td>
        <td>${esc(csvDate(line.period_start))}</td>
        <td>${esc(csvDate(line.period_end))}</td>
        <td>${esc(lineStatus(line))}</td>
        <td>${vacant ? "—" : moneyCell(line.amount, line.currency)}</td>
        <td>${vacant ? "—" : moneyCell(line.amount_paid, line.currency)}</td>
        <td>${esc(note)}</td>
      </tr>`;
    })
    .join("");
  const summaryRows = (report.items || [])
    .map(
      (item) => `<tr>
        <td>${esc(propertyLabel(item))}</td>
        <td>${moneyCell(item.billed_pesos, "PESOS")}</td>
        <td>${moneyCell(item.billed_dolares, "DOLARES")}</td>
        <td>${moneyCell(item.collected_pesos, "PESOS")}</td>
        <td>${moneyCell(item.collected_dolares, "DOLARES")}</td>
      </tr>`
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe de ingresos</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #444; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 28px; }
    th, td { border: 1px solid #bbb; padding: 8px 10px; font-size: 13px; vertical-align: top; }
    th { background: #1f4e79; color: #fff; text-align: left; }
    tfoot td { font-weight: bold; background: #eef3f8; }
    .vacant td { color: #666; font-style: italic; background: #f7f7f7; }
  </style>
</head>
<body>
  <h1>Informe de ingresos</h1>
  <p>Desde ${esc(csvDate(report.start_date))} hasta ${esc(csvDate(report.end_date))}</p>
  <h2 style="font-size:16px">Resumen</h2>
  <table>
    <thead>
      <tr>
        <th>Propiedad</th>
        <th>Facturado $</th>
        <th>Facturado USD</th>
        <th>Cobrado $</th>
        <th>Cobrado USD</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td>${moneyCell(report.totals?.billed_pesos, "PESOS")}</td>
        <td>${moneyCell(report.totals?.billed_dolares, "DOLARES")}</td>
        <td>${moneyCell(report.totals?.collected_pesos, "PESOS")}</td>
        <td>${moneyCell(report.totals?.collected_dolares, "DOLARES")}</td>
      </tr>
    </tfoot>
  </table>
  <h2 style="font-size:16px">Detalle por período</h2>
  <table>
    <thead>
      <tr>
        <th>Propiedad</th>
        <th>Inquilino</th>
        <th>Desde</th>
        <th>Hasta</th>
        <th>Estado</th>
        <th>Facturado</th>
        <th>Cobrado</th>
        <th>Nota</th>
      </tr>
    </thead>
    <tbody>${detailRows || `<tr><td colspan="8">No hay períodos en este rango.</td></tr>`}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ingresos_${report.start_date}_${report.end_date}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
        Facturado son los alquileres de períodos ocupados que se solapan con el rango,
        más el acuerdo de baja si el inquilino paga al dueño. Cobrado es lo pagado
        de esos mismos períodos (incluye cargas iniciales) y el acuerdo de baja.
        Los meses sin ocupación aparecen como «No factura: no está ocupado».
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
        <div>
        <div className="d-flex justify-content-end mb-2">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => exportReportTable(report)}
          >
            Exportar informe
          </Button>
        </div>
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
        <h3 className="h5 mt-4">Detalle por período</h3>
        <div className="table-responsive">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>Inquilino</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Estado</th>
                <th>Facturado</th>
                <th>Cobrado</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {(report.billed_lines || []).map((line, idx) => {
                const vacant = line.kind === "vacant";
                return (
                  <tr key={`${line.property_id}-${line.kind}-${line.period_start}-${idx}`}>
                    <td>{propertyLabel(line)}</td>
                    <td>{line.tenant_name || (vacant ? "—" : "Sin inquilino")}</td>
                    <td>{csvDate(line.period_start)}</td>
                    <td>{csvDate(line.period_end)}</td>
                    <td>
                      {vacant ? (
                        <span className="text-muted">No factura: no está ocupado</span>
                      ) : (
                        lineStatus(line)
                      )}
                    </td>
                    <td>{vacant ? "—" : money(line.amount, line.currency)}</td>
                    <td>{vacant ? "—" : money(line.amount_paid, line.currency)}</td>
                    <td>
                      <small className="text-muted">
                        {vacant ? "No factura: no está ocupado" : line.note || "—"}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        </div>
      )}
    </div>
  );
}
