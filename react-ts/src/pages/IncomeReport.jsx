import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { getProperties } from "../api/property";
import { getGarages } from "../api/garage";
import { getPropertyIncome } from "../api/report";
import SearchableSelect from "../components/SearchableSelect";
import {
  downloadExcelDocument,
  formatEsDate,
  formatMoney,
} from "../utils/exportTable";

function propertyLabel(p) {
  if (p.unit_label) return p.unit_label;
  const parts = [p.direction];
  if (p.floor) parts.push(`Piso ${p.floor}`);
  if (p.apartment) parts.push(`Depto ${p.apartment}`);
  return parts.join(" · ");
}

function money(amount, currency) {
  return formatMoney(amount, currency);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yearStartIso() {
  return `${new Date().getFullYear()}-01-01`;
}

function csvDate(value) {
  return formatEsDate(value);
}

function noBilling(line) {
  return line.kind === "vacant" || line.kind === "sold" || line.kind === "waived";
}

function lineStatus(line) {
  if (line.kind === "vacant") return "No factura: no está ocupado";
  if (line.kind === "sold") return line.note || "Vendida";
  if (line.kind === "waived") return "Sin cobrar por baja";
  if (line.kind === "settlement") return line.note || "Acuerdo de baja";
  return line.payment_status || "—";
}

const SALE_STATUS_LABELS = {
  PAGADA: "Pagada",
  PARCIAL: "Parcial",
  PENDIENTE: "Pendiente",
};

function saleStatusLabel(status) {
  return SALE_STATUS_LABELS[String(status || "").toUpperCase()] || status || "—";
}

function hasSales(report) {
  const t = report?.totals || {};
  return (
    (report?.sale_lines || []).length > 0 ||
    [t.sale_billed_pesos, t.sale_billed_dolares, t.sale_collected_pesos, t.sale_collected_dolares].some(
      (v) => Number(v) !== 0
    )
  );
}

function saleItems(report) {
  return (report?.items || []).filter((item) =>
    [item.sale_billed_pesos, item.sale_billed_dolares, item.sale_collected_pesos, item.sale_collected_dolares].some(
      (v) => Number(v) !== 0
    )
  );
}

function saleSections(report) {
  if (!hasSales(report)) return [];
  return [
    {
      heading: "Ventas",
      headers: ["Propiedad / cochera", "Facturado $", "Facturado USD", "Cobrado $", "Cobrado USD"],
      rows: saleItems(report).map((item) => [
        propertyLabel(item),
        money(item.sale_billed_pesos, "PESOS"),
        money(item.sale_billed_dolares, "DOLARES"),
        money(item.sale_collected_pesos, "PESOS"),
        money(item.sale_collected_dolares, "DOLARES"),
      ]),
      footer: [
        "Total ventas",
        money(report.totals?.sale_billed_pesos, "PESOS"),
        money(report.totals?.sale_billed_dolares, "DOLARES"),
        money(report.totals?.sale_collected_pesos, "PESOS"),
        money(report.totals?.sale_collected_dolares, "DOLARES"),
      ],
      emptyText: "No hay cuotas de venta en este rango.",
    },
    {
      heading: "Detalle de cuotas de venta",
      headers: ["Propiedad / cochera", "Comprador", "Cuota", "Vencimiento", "Monto", "Pagado", "Fecha de pago", "Estado"],
      rows: (report.sale_lines || []).map((line) => [
        propertyLabel(line),
        line.buyer_name || "—",
        line.label,
        csvDate(line.due_date),
        money(line.amount, line.currency),
        money(line.amount_paid, line.currency),
        line.paid_at ? csvDate(line.paid_at) : "—",
        saleStatusLabel(line.status),
      ]),
      emptyText: "No hay cuotas de venta en este rango.",
    },
  ];
}

function exportReportTable(report) {
  if (!report) return;
  downloadExcelDocument({
    filename: `ingresos_${report.start_date}_${report.end_date}.xls`,
    title: "Informe de ingresos",
    subtitle: `Desde ${csvDate(report.start_date)} hasta ${csvDate(report.end_date)}`,
    sections: [
      {
        heading: "Resumen",
        headers: ["Propiedad / cochera", "Facturado $", "Facturado USD", "Cobrado $", "Cobrado USD"],
        rows: (report.items || []).map((item) => [
          propertyLabel(item),
          money(item.billed_pesos, "PESOS"),
          money(item.billed_dolares, "DOLARES"),
          money(item.collected_pesos, "PESOS"),
          money(item.collected_dolares, "DOLARES"),
        ]),
        footer: [
          "Total",
          money(report.totals?.billed_pesos, "PESOS"),
          money(report.totals?.billed_dolares, "DOLARES"),
          money(report.totals?.collected_pesos, "PESOS"),
          money(report.totals?.collected_dolares, "DOLARES"),
        ],
        emptyText: "No hay propiedades en este rango.",
      },
      {
        heading: "Detalle por período",
        headers: [
          "Propiedad / cochera",
          "Inquilino",
          "Desde",
          "Hasta",
          "Estado",
          "Facturado",
          "Cobrado",
          "Nota",
        ],
        rows: (report.billed_lines || []).map((line) => {
          const vacant = noBilling(line);
          return {
            className: vacant ? "vacant" : undefined,
              cells: [
              propertyLabel(line),
              line.tenant_name || (vacant ? "—" : "Sin inquilino"),
              csvDate(line.period_start),
              csvDate(line.period_end),
              lineStatus(line),
              vacant ? "—" : money(line.amount, line.currency),
              vacant ? "—" : money(line.amount_paid, line.currency),
              (vacant && line.kind !== "waived" ? lineStatus(line) : line.note) || "—",
            ],
          };
        }),
        emptyText: "No hay períodos en este rango.",
      },
      ...saleSections(report),
    ],
  });
}

export default function IncomeReport() {
  const [properties, setProperties] = useState([]);
  const [garages, setGarages] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState(yearStartIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [loadingProps, setLoadingProps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    Promise.all([
      getProperties({ includeSold: true }).catch(() => null),
      getGarages({ includeSold: true }).catch(() => null),
    ])
      .then(([propList, garageList]) => {
        setProperties(propList || []);
        setGarages(garageList || []);
        if (!propList) setError("No se pudieron cargar las propiedades.");
      })
      .finally(() => setLoadingProps(false));
  }, []);

  const options = useMemo(
    () => [
      ...properties.map((p) => ({
        value: `p-${p.id}`,
        label:
          p.management_status === "SOLD_OUT"
            ? `${propertyLabel(p)} (vendida)`
            : propertyLabel(p),
        search: `${p.direction} ${p.floor || ""} ${p.apartment || ""} ${p.owner?.name || ""}`,
      })),
      ...garages.map((g) => {
        const label = g.label || `Garage N° ${g.number}`;
        return {
          value: `g-${g.id}`,
          label: g.management_status === "SOLD_OUT" ? `${label} (vendida)` : label,
          search: `cochera garage ${g.number} ${g.property_direction || ""} ${g.owner_name || ""}`,
        };
      }),
    ],
    [properties, garages]
  );

  const loadReport = async () => {
    if (!selectedIds.length) {
      setError("Seleccioná al menos una propiedad o cochera.");
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
      const idsOf = (prefix) =>
        selectedIds
          .filter((key) => key.startsWith(`${prefix}-`))
          .map((key) => Number(key.slice(2)));
      const data = await getPropertyIncome({
        propertyIds: idsOf("p"),
        garageIds: idsOf("g"),
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
      <h2 className="h4">Ingresos por propiedades y cocheras</h2>
      <p className="text-muted small">
        Facturado son los alquileres de períodos ocupados que se solapan con el rango,
        más el acuerdo de baja si el inquilino paga al dueño. Cobrado es lo pagado
        de esos mismos períodos (incluye cargas iniciales) y el acuerdo de baja.
        Los meses sin ocupación aparecen como «No factura: no está ocupado», y el
        mes de una baja anticipada que no se cobró, como «Sin cobrar por baja».
        Las cocheras cuentan sus alquileres propios; si van dentro del contrato
        de una propiedad, ese alquiler se suma a la propiedad.
        Las ventas van aparte: facturado son las cuotas que vencen en el rango y
        cobrado lo pagado de esas cuotas.
      </p>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col xs={12} lg={6}>
          <Form.Label>Propiedades y cocheras</Form.Label>
          {loadingProps ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <SearchableSelect
              multiple
              options={options}
              value={selectedIds}
              onChange={(vals) => setSelectedIds((vals || []).map(String))}
              placeholder="Buscar y agregar propiedades o cocheras..."
              emptyText="No hay propiedades ni cocheras que coincidan."
            />
          )}
          <div className="d-flex flex-wrap gap-2 mt-2">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setSelectedIds(options.map((o) => o.value))}
              disabled={!options.length}
            >
              Seleccionar todas
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setSelectedIds(properties.map((p) => `p-${p.id}`))}
              disabled={!properties.length}
            >
              Solo propiedades
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setSelectedIds(garages.map((g) => `g-${g.id}`))}
              disabled={!garages.length}
            >
              Solo cocheras
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
                <th>Propiedad / cochera</th>
                <th>Facturado $</th>
                <th>Facturado USD</th>
                <th>Cobrado $</th>
                <th>Cobrado USD</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.unit_key}>
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
                <th>Propiedad / cochera</th>
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
                const vacant = noBilling(line);
                return (
                  <tr key={`${line.unit_key}-${line.kind}-${line.period_start}-${idx}`}>
                    <td>{propertyLabel(line)}</td>
                    <td>{line.tenant_name || (vacant ? "—" : "Sin inquilino")}</td>
                    <td>{csvDate(line.period_start)}</td>
                    <td>{csvDate(line.period_end)}</td>
                    <td>
                      {vacant ? (
                        <span className="text-muted">{lineStatus(line)}</span>
                      ) : (
                        lineStatus(line)
                      )}
                    </td>
                    <td>{vacant ? "—" : money(line.amount, line.currency)}</td>
                    <td>{vacant ? "—" : money(line.amount_paid, line.currency)}</td>
                    <td>
                      <small className="text-muted">
                        {(vacant && line.kind !== "waived" ? lineStatus(line) : line.note) || "—"}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        {hasSales(report) && (
          <>
            <h3 className="h5 mt-4">Ventas</h3>
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Propiedad / cochera</th>
                    <th>Facturado $</th>
                    <th>Facturado USD</th>
                    <th>Cobrado $</th>
                    <th>Cobrado USD</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems(report).map((item) => (
                    <tr key={item.unit_key}>
                      <td>{propertyLabel(item)}</td>
                      <td>{money(item.sale_billed_pesos, "PESOS")}</td>
                      <td>{money(item.sale_billed_dolares, "DOLARES")}</td>
                      <td>{money(item.sale_collected_pesos, "PESOS")}</td>
                      <td>{money(item.sale_collected_dolares, "DOLARES")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fw-bold">
                    <td>Total ventas</td>
                    <td>{money(report.totals.sale_billed_pesos, "PESOS")}</td>
                    <td>{money(report.totals.sale_billed_dolares, "DOLARES")}</td>
                    <td>{money(report.totals.sale_collected_pesos, "PESOS")}</td>
                    <td>{money(report.totals.sale_collected_dolares, "DOLARES")}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
            <h3 className="h5 mt-4">Detalle de cuotas de venta</h3>
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Propiedad / cochera</th>
                    <th>Comprador</th>
                    <th>Cuota</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th>Pagado</th>
                    <th>Fecha de pago</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.sale_lines || []).map((line, idx) => (
                    <tr key={`${line.sale_id}-${line.due_date}-${idx}`}>
                      <td>{propertyLabel(line)}</td>
                      <td>{line.buyer_name || "—"}</td>
                      <td>{line.label}</td>
                      <td>{csvDate(line.due_date)}</td>
                      <td>{money(line.amount, line.currency)}</td>
                      <td>{money(line.amount_paid, line.currency)}</td>
                      <td>{line.paid_at ? csvDate(line.paid_at) : "—"}</td>
                      <td>{saleStatusLabel(line.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
        </div>
      )}
    </div>
  );
}
