import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { getAllAgencies } from "../api/real_agency";
import { getAllPendingPeriods, getPeriodsByContract } from "../api/contract_period";
import { getContract, getContractHistory, getContracts } from "../api/contract";
import { getGarages } from "../api/garage";
import { getOwners, getTenants } from "../api/person";
import { getProperties, getPropertyById } from "../api/property";
import { getAllTransactions } from "../api/transaction";
import SearchableSelect from "../components/SearchableSelect";
import {
  downloadExcelDocument,
  formatEsDate,
  formatMoney,
  yesNo,
} from "../utils/exportTable";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yearStartIso() {
  return `${new Date().getFullYear()}-01-01`;
}

function parseDay(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function monthLabel(value) {
  const day = parseDay(value);
  if (!day) return "—";
  return `${MONTHS_ES[day.getMonth()]} ${day.getFullYear()}`;
}

function propertyLabel(p) {
  if (!p) return "Sin dirección";
  const parts = [p.direction || p.property_direction].filter(Boolean);
  if (p.floor) parts.push(`Piso ${p.floor}`);
  if (p.apartment) parts.push(`Depto ${p.apartment}`);
  return parts.join(" · ") || "Sin dirección";
}

function locationFromPeriod(period) {
  const contract = period?.contract;
  if (contract?.property) return propertyLabel(contract.property);
  return contract?.garage_label || "Sin dirección";
}

function findCurrentPeriod(periods) {
  if (!periods?.length) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    periods.find((period) => {
      const start = parseDay(period.start_date);
      const end = parseDay(period.end_date);
      return start && end && start <= today && today <= end;
    }) || null
  );
}

function periodCurrency(period, fallback) {
  return period?.contract?.currency || fallback || "PESOS";
}

function remainingOf(period) {
  const total = Number(period?.total_amount) || 0;
  const paid = Number(period?.amount_paid) || 0;
  return Math.max(0, round2(total - paid));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function taxTotal(period) {
  const taxes = period?.taxes || {};
  return round2(
    (Number(taxes.epe) || 0) +
      (Number(taxes.tgi) || 0) +
      (Number(taxes.api) || 0) +
      (Number(taxes.fire_insurance) || 0)
  );
}

function upToDateLabel(period) {
  if (!period) return "—";
  const status = period.payment_status || "PENDIENTE";
  if (status === "PAGADO") return "Sí";
  return `No (${status})`;
}

function occupancyLabel(property) {
  if (property?.rental_contract) return "Alquilada";
  const status = property?.management_status || "ACTIVE";
  if (status === "DELIVERED") return "Entregada";
  if (status === "SOLD_OUT") return "Vendida";
  return "Disponible";
}

function garageListLabel(garages) {
  if (!garages?.length) return "—";
  return garages
    .map((g) => `N° ${g.number}${g.rental_contract_id ? " (alquilada)" : " (libre)"}`)
    .join(", ");
}

function enumLabel(value) {
  return value || "—";
}

function boolTaxes(contract) {
  const flags = [];
  if (contract?.pays_epe) flags.push("EPE");
  if (contract?.pays_tgi) flags.push("TGI");
  if (contract?.pays_api) flags.push("API");
  if (contract?.fire_insurance) flags.push("Seguro incendio");
  return flags.length ? flags.join(", ") : "—";
}

function collectorLabel(value) {
  return String(value || "").toUpperCase() === "INTERMEDIARIO" ? "Intermediario" : "Dueño";
}

function fileStamp() {
  return todayIso();
}

async function fetchAllPages(loadPage) {
  const pageSize = 100;
  let page = 1;
  const items = [];
  for (;;) {
    const data = await loadPage(page, pageSize);
    const chunk = data?.items || [];
    items.push(...chunk);
    const pages = data?.pages || 1;
    if (page >= pages || chunk.length === 0) break;
    page += 1;
  }
  return items;
}

function periodRows(periods, currencyFallback) {
  return (periods || []).map((period) => {
    const currency = periodCurrency(period, currencyFallback);
    const rent = period.period_rent ?? period.indexed_amount ?? period.base_rent;
    return [
      monthLabel(period.start_date),
      formatEsDate(period.start_date),
      formatEsDate(period.end_date),
      formatEsDate(period.due_date),
      formatMoney(rent, currency),
      formatMoney(taxTotal(period), currency),
      formatMoney(period.total_amount, currency),
      formatMoney(period.amount_paid, currency),
      formatMoney(remainingOf(period), currency),
      period.payment_status || "—",
      period.payment_method || "—",
      formatEsDate(period.payment_date) || "—",
    ];
  });
}

const PERIOD_HEADERS = [
  "Mes",
  "Desde",
  "Hasta",
  "Vencimiento",
  "Alquiler",
  "Impuestos",
  "Total",
  "Pagado",
  "Saldo",
  "Estado",
  "Método",
  "Fecha de pago",
];

function propertySnapshotRow(property) {
  const contract = property.rental_contract;
  const current = findCurrentPeriod(contract?.periods);
  const currency = contract?.currency || periodCurrency(current, "PESOS");
  return [
    propertyLabel(property),
    property.owner?.name || "—",
    occupancyLabel(property),
    yesNo(Boolean(contract)),
    yesNo(Boolean(contract?.document_path)),
    contract?.tenant?.name || "—",
    formatEsDate(contract?.start_date) || "—",
    formatEsDate(contract?.end_date) || "—",
    current ? formatMoney(current.total_amount, currency) : "—",
    upToDateLabel(current),
    current ? formatMoney(remainingOf(current), currency) : "—",
    formatEsDate(current?.due_date) || "—",
    currency === "DOLARES" ? "USD" : "$",
    garageListLabel(property.garages),
  ];
}

const PROPERTY_HEADERS = [
  "Dirección",
  "Propietario",
  "Estado",
  "Alquilada",
  "Contrato cargado",
  "Inquilino",
  "Inicio contrato",
  "Fin contrato",
  "Paga este mes",
  "Al día",
  "Saldo",
  "Vencimiento",
  "Moneda",
  "Cocheras",
];

export default function ExportPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [properties, setProperties] = useState([]);
  const [garages, setGarages] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [txStart, setTxStart] = useState(yearStartIso);
  const [txEnd, setTxEnd] = useState(todayIso);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProperties(), getGarages(), getContracts()])
      .then(([props, garageList, contractList]) => {
        if (cancelled) return;
        setProperties(props || []);
        setGarages(garageList || []);
        setContracts(contractList || []);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar propiedades y contratos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const propertyOptions = useMemo(
    () =>
      properties.map((p) => ({
        value: String(p.id),
        label: propertyLabel(p),
        search: `${p.direction} ${p.floor || ""} ${p.apartment || ""} ${p.owner?.name || ""}`,
      })),
    [properties]
  );

  const contractOptions = useMemo(() => {
    const fromProps = properties
      .filter((p) => p.rental_contract?.id)
      .map((p) => ({
        value: String(p.rental_contract.id),
        label: `${p.rental_contract.tenant?.name || "Sin inquilino"} — ${propertyLabel(p)}`,
        search: `${p.rental_contract.tenant?.name || ""} ${propertyLabel(p)}`,
      }));
    const used = new Set(fromProps.map((o) => o.value));
    const fromGarages = garages
      .filter((g) => g.rental_contract_id && !used.has(String(g.rental_contract_id)))
      .map((g) => ({
        value: String(g.rental_contract_id),
        label: `${g.tenant_name || "Sin inquilino"} — Garage N° ${g.number}`,
        search: `${g.tenant_name || ""} garage ${g.number} ${g.property_direction || ""}`,
      }));
    fromGarages.forEach((o) => used.add(o.value));
    const extras = (contracts || [])
      .filter((c) => c.status === 1 && !used.has(String(c.id)))
      .map((c) => ({
        value: String(c.id),
        label: `Contrato #${c.id}`,
        search: `contrato ${c.id}`,
      }));
    return [...fromProps, ...fromGarages, ...extras];
  }, [properties, garages, contracts]);

  const run = async (key, action) => {
    try {
      setBusy(key);
      setError("");
      await action();
    } catch (err) {
      setError(err.message || "No se pudo exportar.");
    } finally {
      setBusy("");
    }
  };

  const exportProperties = () =>
    run("properties", async () => {
      downloadExcelDocument({
        filename: `cartera_propiedades_${fileStamp()}.xls`,
        title: "Cartera de propiedades",
        subtitle: `Exportado el ${formatEsDate(todayIso())}`,
        sections: [
          {
            headers: PROPERTY_HEADERS,
            rows: properties.map(propertySnapshotRow),
            emptyText: "No hay propiedades.",
          },
        ],
      });
    });

  const exportGarages = () =>
    run("garages", async () => {
      const rentedIds = [
        ...new Set(garages.filter((g) => g.rental_contract_id).map((g) => g.rental_contract_id)),
      ];
      const periodMap = {};
      await Promise.all(
        rentedIds.map(async (id) => {
          try {
            periodMap[id] = (await getPeriodsByContract(id)) || [];
          } catch {
            periodMap[id] = [];
          }
        })
      );
      downloadExcelDocument({
        filename: `cocheras_${fileStamp()}.xls`,
        title: "Cocheras",
        subtitle: `Exportado el ${formatEsDate(todayIso())}`,
        sections: [
          {
            headers: [
              "Número",
              "Propietario",
              "Propiedad asociada",
              "Alquilada",
              "Inquilino",
              "Contrato cargado",
              "Paga este mes",
              "Al día",
              "Saldo",
            ],
            rows: garages.map((g) => {
              const periods = g.rental_contract_id ? periodMap[g.rental_contract_id] || [] : [];
              const current = findCurrentPeriod(periods);
              const currency = periodCurrency(current, "PESOS");
              const doc = periods[0]?.contract?.document_path;
              return [
                `N° ${g.number}`,
                g.owner_name || "—",
                g.property_direction || "—",
                yesNo(Boolean(g.rental_contract_id)),
                g.tenant_name || "—",
                current || periods.length ? yesNo(Boolean(doc)) : "—",
                current ? formatMoney(current.total_amount, currency) : "—",
                upToDateLabel(current),
                current ? formatMoney(remainingOf(current), currency) : "—",
              ];
            }),
            emptyText: "No hay cocheras.",
          },
        ],
      });
    });

  const exportOneProperty = () =>
    run("one-property", async () => {
      if (!selectedPropertyId) throw new Error("Seleccioná una propiedad.");
      const property = await getPropertyById(Number(selectedPropertyId));
      const contract = property.rental_contract;
      const periods = contract?.id ? await getPeriodsByContract(contract.id) : [];
      const currency = contract?.currency || periodCurrency(periods[0], "PESOS");
      downloadExcelDocument({
        filename: `propiedad_${property.id}_${fileStamp()}.xls`,
        title: `Propiedad — ${propertyLabel(property)}`,
        subtitle: `Exportado el ${formatEsDate(todayIso())}`,
        sections: [
          {
            heading: "Resumen",
            headers: PROPERTY_HEADERS,
            rows: [propertySnapshotRow(property)],
          },
          {
            heading: contract ? "Períodos del contrato" : "Períodos",
            headers: PERIOD_HEADERS,
            rows: periodRows(periods, currency),
            emptyText: contract ? "El contrato no tiene períodos." : "No está alquilada.",
          },
        ],
      });
    });

  const exportOneContract = () =>
    run("one-contract", async () => {
      if (!selectedContractId) throw new Error("Seleccioná un contrato.");
      const [contract, periods] = await Promise.all([
        getContract(Number(selectedContractId)),
        getPeriodsByContract(Number(selectedContractId)),
      ]);
      const first = periods[0];
      let owner = "—";
      let location = locationFromPeriod(first) || "Sin dirección";
      if (contract.property_id) {
        try {
          const prop = await getPropertyById(contract.property_id);
          owner = prop.owner?.name || "—";
          location = propertyLabel(prop);
        } catch {
          /* keep labels from the period */
        }
      } else if (contract.garage_id) {
        const garage = garages.find((g) => g.id === contract.garage_id);
        owner = garage?.owner_name || "—";
        location = garage ? `Garage N° ${garage.number}` : location;
      }
      const tenant = first?.contract?.tenant?.name || "—";
      const currency = contract.currency || periodCurrency(first, "PESOS");
      downloadExcelDocument({
        filename: `contrato_${contract.id}_${fileStamp()}.xls`,
        title: `Contrato #${contract.id}`,
        subtitle: `${tenant} — ${location}`,
        sections: [
          {
            heading: "Cabecera",
            headers: ["Campo", "Valor"],
            rows: [
              ["Inquilino", tenant],
              ["Ubicación", location],
              ["Dueño", owner],
              ["Inicio", formatEsDate(contract.start_date)],
              ["Fin", formatEsDate(contract.end_date)],
              ["Moneda", currency === "DOLARES" ? "USD" : "$"],
              ["Alquiler base", formatMoney(contract.base_rent, currency)],
              ["Índice", enumLabel(contract.index_type)],
              ["Frecuencia", enumLabel(contract.frequency_adjustment)],
              ["Impuestos", boolTaxes(contract)],
              ["Contrato cargado", yesNo(Boolean(contract.document_path))],
              ["Notas", contract.notes || "—"],
            ],
          },
          {
            heading: "Períodos",
            headers: PERIOD_HEADERS,
            rows: periodRows(periods, currency),
            emptyText: "El contrato no tiene períodos.",
          },
        ],
      });
    });

  const exportUnpaid = () =>
    run("unpaid", async () => {
      const periods = (await getAllPendingPeriods()) || [];
      downloadExcelDocument({
        filename: `periodos_impagos_${fileStamp()}.xls`,
        title: "Períodos impagos / vencidos",
        subtitle: `Exportado el ${formatEsDate(todayIso())}`,
        sections: [
          {
            headers: [
              "Inquilino",
              "Ubicación",
              "Mes",
              "Vencimiento",
              "Total",
              "Pagado",
              "Saldo",
              "Estado",
            ],
            rows: periods.map((period) => {
              const currency = periodCurrency(period, "PESOS");
              return [
                period.contract?.tenant?.name || "Sin inquilino",
                locationFromPeriod(period),
                monthLabel(period.start_date),
                formatEsDate(period.due_date),
                formatMoney(period.total_amount, currency),
                formatMoney(period.amount_paid, currency),
                formatMoney(remainingOf(period), currency),
                period.payment_status || "—",
              ];
            }),
            emptyText: "No hay períodos impagos.",
          },
        ],
      });
    });

  const exportTransactions = () =>
    run("transactions", async () => {
      if (!txStart || !txEnd) throw new Error("Completá el rango de fechas.");
      if (txStart > txEnd) throw new Error("La fecha desde no puede ser posterior a la fecha hasta.");
      const items = await fetchAllPages((page, pageSize) =>
        getAllTransactions({ page, pageSize })
      );
      const filtered = items.filter((tx) => {
        const day = String(tx.date || "").slice(0, 10);
        return day >= txStart && day <= txEnd;
      });
      downloadExcelDocument({
        filename: `transacciones_${txStart}_${txEnd}.xls`,
        title: "Transacciones",
        subtitle: `Desde ${formatEsDate(txStart)} hasta ${formatEsDate(txEnd)}`,
        sections: [
          {
            headers: [
              "Fecha",
              "Ubicación",
              "Dueño",
              "Inquilino / comprador",
              "Monto",
              "Moneda",
              "Método",
              "Quién cobró",
            ],
            rows: filtered.map((tx) => [
              formatEsDate(tx.date),
              tx.contract?.property_direction || "—",
              tx.contract?.owner?.name || "—",
              tx.contract?.tenant?.name || "—",
              formatMoney(tx.amount, tx.currency),
              tx.currency === "DOLARES" ? "USD" : "$",
              tx.method || "—",
              collectorLabel(tx.received_by),
            ]),
            emptyText: "No hay transacciones en ese rango.",
          },
        ],
      });
    });

  const exportPeople = (kind) =>
    run(`people-${kind}`, async () => {
      if (kind === "owners") {
        const owners = (await getOwners()) || [];
        downloadExcelDocument({
          filename: `propietarios_${fileStamp()}.xls`,
          title: "Propietarios",
          sections: [
            {
              headers: ["Nombre", "Teléfono", "Email"],
              rows: owners.map((p) => [p.name, p.phone || "—", p.email || "—"]),
              emptyText: "No hay propietarios.",
            },
          ],
        });
        return;
      }
      if (kind === "tenants") {
        const tenants = (await getTenants()) || [];
        downloadExcelDocument({
          filename: `inquilinos_${fileStamp()}.xls`,
          title: "Inquilinos",
          sections: [
            {
              headers: ["Nombre", "Teléfono", "Email"],
              rows: tenants.map((p) => [p.name, p.phone || "—", p.email || "—"]),
              emptyText: "No hay inquilinos.",
            },
          ],
        });
        return;
      }
      const agencies = (await getAllAgencies()) || [];
      downloadExcelDocument({
        filename: `agencias_${fileStamp()}.xls`,
        title: "Agencias",
        sections: [
          {
            headers: ["Nombre", "Dirección"],
            rows: agencies.map((p) => [p.name, p.direction || "—"]),
            emptyText: "No hay agencias.",
          },
        ],
      });
    });

  const exportHistory = () =>
    run("history", async () => {
      const items = await fetchAllPages((page, pageSize) =>
        getContractHistory({ page, pageSize })
      );
      downloadExcelDocument({
        filename: `historial_contratos_${fileStamp()}.xls`,
        title: "Historial de contratos",
        subtitle: `Exportado el ${formatEsDate(todayIso())}`,
        sections: [
          {
            headers: [
              "Propiedad",
              "Dueño",
              "Inquilino",
              "Inicio",
              "Fin",
              "Estado",
              "Archivo de contrato",
            ],
            rows: items.map((item) => [
              item.property_address || propertyLabel(item.property),
              item.owner_name || "—",
              item.tenant_name || item.tenant?.name || "—",
              formatEsDate(item.start_date),
              formatEsDate(item.end_date),
              item.cancelled ? "Cancelado" : "Activo",
              yesNo(Boolean(item.document_path)),
            ]),
            emptyText: "No hay contratos en el historial.",
          },
        ],
      });
    });

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="h4">Exportar</h2>
      <p className="text-muted">
        Bajá un Excel con el recorte que necesites. El informe de ingresos sigue en{" "}
        <Link to="/ingresos">Ingresos</Link>.
      </p>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      <Row className="g-3">
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Cartera de propiedades</Card.Title>
              <Card.Text className="text-muted small">
                Alquilada, contrato cargado, al día, cuánto paga este mes, inquilino y cocheras.
              </Card.Text>
              <Button onClick={exportProperties} disabled={Boolean(busy)}>
                {busy === "properties" ? "Generando..." : "Descargar cartera"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Cocheras</Card.Title>
              <Card.Text className="text-muted small">
                Número, dueño, si está alquilada, monto del mes y si está al día.
              </Card.Text>
              <Button onClick={exportGarages} disabled={Boolean(busy)}>
                {busy === "garages" ? "Generando..." : "Descargar cocheras"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Una propiedad</Card.Title>
              <Form.Label className="small">Propiedad</Form.Label>
              <SearchableSelect
                options={propertyOptions}
                value={selectedPropertyId}
                onChange={setSelectedPropertyId}
                placeholder="Buscar propiedad..."
              />
              <Button className="mt-3" onClick={exportOneProperty} disabled={Boolean(busy)}>
                {busy === "one-property" ? "Generando..." : "Descargar propiedad"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Un contrato</Card.Title>
              <Form.Label className="small">Contrato activo</Form.Label>
              <SearchableSelect
                options={contractOptions}
                value={selectedContractId}
                onChange={setSelectedContractId}
                placeholder="Buscar inquilino o dirección..."
              />
              <Button className="mt-3" onClick={exportOneContract} disabled={Boolean(busy)}>
                {busy === "one-contract" ? "Generando..." : "Descargar contrato"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Períodos impagos / vencidos</Card.Title>
              <Card.Text className="text-muted small">
                Lista operativa: inquilino, ubicación, mes, vencimiento, saldo y estado.
              </Card.Text>
              <Button onClick={exportUnpaid} disabled={Boolean(busy)}>
                {busy === "unpaid" ? "Generando..." : "Descargar impagos"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Transacciones</Card.Title>
              <Row className="g-2">
                <Col>
                  <Form.Label className="small">Desde</Form.Label>
                  <Form.Control
                    type="date"
                    value={txStart}
                    onChange={(e) => setTxStart(e.target.value)}
                  />
                </Col>
                <Col>
                  <Form.Label className="small">Hasta</Form.Label>
                  <Form.Control
                    type="date"
                    value={txEnd}
                    onChange={(e) => setTxEnd(e.target.value)}
                  />
                </Col>
              </Row>
              <Button className="mt-3" onClick={exportTransactions} disabled={Boolean(busy)}>
                {busy === "transactions" ? "Generando..." : "Descargar transacciones"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Personas</Card.Title>
              <Card.Text className="text-muted small">Nombre, teléfono y email.</Card.Text>
              <div className="d-flex flex-wrap gap-2">
                <Button
                  variant="outline-primary"
                  onClick={() => exportPeople("owners")}
                  disabled={Boolean(busy)}
                >
                  {busy === "people-owners" ? "..." : "Propietarios"}
                </Button>
                <Button
                  variant="outline-primary"
                  onClick={() => exportPeople("tenants")}
                  disabled={Boolean(busy)}
                >
                  {busy === "people-tenants" ? "..." : "Inquilinos"}
                </Button>
                <Button
                  variant="outline-primary"
                  onClick={() => exportPeople("agencies")}
                  disabled={Boolean(busy)}
                >
                  {busy === "people-agencies" ? "..." : "Agencias"}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body>
              <Card.Title>Historial de contratos</Card.Title>
              <Card.Text className="text-muted small">
                Propiedad, dueño, inquilino, fechas, activo/cancelado y si hay archivo.
              </Card.Text>
              <Button onClick={exportHistory} disabled={Boolean(busy)}>
                {busy === "history" ? "Generando..." : "Descargar historial"}
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
