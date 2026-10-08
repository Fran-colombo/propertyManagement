import { useEffect, useState } from "react";
import { Button, Spinner, Table, Alert, Form, Tab, Tabs, Row, Col, Card } from "react-bootstrap";
import { getAllPendingPeriods, registerPayment, updateTaxes, getPeriodsByMonth } from "../api/contract_period";
import { syncContractTgi } from "../api/contract";
import PayPeriodModal from "../components/PayPeriodModal";
import EditTaxesModal, { tgiBreakdownLines } from "../components/EditTaxesModal";
import CreateContractModal from "../components/CreateContractModal";
import UpdateIndexModal from "../components/UpdateIndexModal";
import CancelContractModal from "../components/CancelContractModal";
import EditContractModal from "../components/EditContractModal";
import { mediaUrl } from "../utils/mediaUrl";

function parseISODate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatPropertyAddress(property, garageLabel) {
  if (!property) return garageLabel || "Dirección no disponible";
  const parts = [];
  if (property.direction) parts.push(property.direction);
  if (property.floor) parts.push(`Piso ${property.floor}`);
  if (property.apartment) parts.push(`Depto ${property.apartment}`);
  return parts.length ? parts.join(" · ") : garageLabel || "Dirección no disponible";
}

function sortActivePeriods(list, year, month) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month - 1, 1);
  const rank = (period) => {
    const end = parseISODate(period.contract?.end_date);
    const due = parseISODate(period.due_date || period.start_date);
    const unpaid =
      period.payment_status !== "PAGADO" &&
      period.payment_status !== "CONTRATO_TERMINADO";
    if (end && end < today) return 0;
    if (unpaid && due && due < monthStart) return 1;
    return 2;
  };
  return (list || []).slice().sort((a, b) => {
    const byGroup = rank(a) - rank(b);
    if (byGroup !== 0) return byGroup;
    const da = parseISODate(a.due_date || a.start_date) || 0;
    const db = parseISODate(b.due_date || b.start_date) || 0;
    return da - db;
  });
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ContractsTable = () => {
  const today = new Date();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showTaxesModal, setShowTaxesModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [contractToCancel, setContractToCancel] = useState(null);
  const [contractToEdit, setContractToEdit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [tenants, setTenants] = useState([]);
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [showAllPending, setShowAllPending] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("pending");
  const [syncingTgiId, setSyncingTgiId] = useState(null);

  useEffect(() => {
    loadPeriods();
  }, [filterYear, filterMonth, showAllPending, paymentFilter]);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = showAllPending
        ? await getAllPendingPeriods()
        : await getPeriodsByMonth(filterYear, filterMonth, paymentFilter);

      const list = sortActivePeriods(data || [], filterYear, filterMonth);

      const allTenants = list
        .map((p) => p.contract?.tenant)
        .filter((t, i, arr) => t && arr.findIndex((t2) => t2.id === t.id) === i);

      setTenants(allTenants);
      setPeriods(list);
    } catch (err) {
      console.error("Error al cargar los períodos pendientes:", err);
      setError("No se pudieron cargar los períodos pendientes.");
      setPeriods([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (periodId, paymentData) => {
    await registerPayment(periodId, paymentData);
    loadPeriods();
  };

  const handleTaxUpdate = async (periodId, taxData) => {
    await updateTaxes(periodId, taxData);
    loadPeriods();
  };

  const handleSyncTgi = async (contractId) => {
    if (!contractId) return;
    setSyncingTgiId(contractId);
    setError(null);
    try {
      const result = await syncContractTgi(contractId);
      if (result?.tgi_sync_error) {
        setError(result.tgi_sync_error);
      } else if (result?.note) {
        setError(result.note);
      }
      await loadPeriods();
    } catch (err) {
      setError(err.message || "No se pudo consultar el TGI en el SIAT.");
    } finally {
      setSyncingTgiId(null);
    }
  };

  const getFilteredPeriods = () => {
    let filtered = periods;

    if (selectedTenant !== "all") {
      const tenantId = parseInt(selectedTenant, 10);
      filtered = filtered.filter((p) => p.contract?.tenant?.id === tenantId);
    }

    return filtered;
  };

  const splitPeriodsByAgency = (list) => {
    return list.reduce(
      (acc, period) => {
        if (period.contract?.real_agency) {
          acc.withAgency.push(period);
        } else {
          acc.withoutAgency.push(period);
        }
        return acc;
      },
      { withAgency: [], withoutAgency: [] }
    );
  };

  const yearOptions = [];
  for (let y = today.getFullYear() - 2; y <= today.getFullYear() + 2; y++) {
    yearOptions.push(y);
  }

  if (loading && periods.length === 0) return <Spinner animation="border" className="m-5" />;

  const displayedPeriods = getFilteredPeriods();
  const { withAgency, withoutAgency } = splitPeriodsByAgency(displayedPeriods);

  const PeriodsTable = ({ periods: tablePeriods, title }) => {
    const renderPeriodActions = (period) => (
      <div className="d-flex flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          onClick={() => {
            setSelectedPeriod(period);
            setShowPayModal(true);
          }}
          disabled={period.payment_status === "PAGADO"}
        >
          Pagar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSelectedPeriod(period);
            setShowTaxesModal(true);
          }}
          disabled={period.payment_status === "PAGADO"}
        >
          Impuestos
        </Button>
        {period.contract?.id &&
          period.contract?.currency !== "DOLARES" &&
          period.contract?.index_type && (
            <Button
              variant="info"
              size="sm"
              onClick={() => {
                setSelectedPeriod(period);
                setShowIndexModal(true);
              }}
              disabled={period.payment_status === "PAGADO"}
            >
              Índice
            </Button>
          )}
        {period.contract?.id && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              setContractToEdit(period.contract);
              setShowEditModal(true);
            }}
          >
            Editar
          </Button>
        )}
        {period.contract?.document_path && (
          <Button
            variant="outline-primary"
            size="sm"
            as="a"
            href={mediaUrl(period.contract.document_path)}
            target="_blank"
            rel="noreferrer"
          >
            Ver contrato
          </Button>
        )}
        {period.contract?.id && period.contract?.pays_tgi && period.payment_status !== "PAGADO" && (
          <Button
            variant="outline-info"
            size="sm"
            onClick={() => handleSyncTgi(period.contract.id)}
            disabled={syncingTgiId === period.contract.id}
            title="Consulta el SIAT y carga el TGI del mes que se está cobrando, más el vencido más antiguo"
          >
            {syncingTgiId === period.contract.id ? "Consultando TGI..." : "Actualizar TGI"}
          </Button>
        )}
        {period.contract?.id && (
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => {
              setContractToCancel(period.contract);
              setShowCancelModal(true);
            }}
          >
            Finalizar
          </Button>
        )}
      </div>
    );

    const periodMeta = (period) => {
      const taxes = period.taxes || {};
      const totalTaxes =
        (taxes.epe || 0) +
        (taxes.tgi || 0) +
        (taxes.api || 0) +
        (taxes.fire_insurance || 0);
      const dueDate = parseISODate(period.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue =
        !!dueDate &&
        dueDate < today &&
        period.payment_status !== "PAGADO" &&
        period.payment_status !== "CONTRATO_TERMINADO";
      const tenant = period.contract?.tenant;
      const propertyAddress = formatPropertyAddress(
        period.contract?.property,
        period.contract?.garage_label
      );
      const contractEnd = parseISODate(period.contract?.end_date);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const contractEnded = !!(contractEnd && contractEnd < todayStart);
      const periodStart = parseISODate(period.start_date);
      const periodEnd = parseISODate(period.end_date);
      const monthStart = new Date(filterYear, filterMonth - 1, 1);
      const monthEnd = new Date(filterYear, filterMonth, 0);
      const overlapsMonth =
        periodStart &&
        periodEnd &&
        periodStart <= monthEnd &&
        periodEnd >= monthStart;
      const outsideMonth = !showAllPending && !overlapsMonth;
      const tgiLines = tgiBreakdownLines(period.tgi_detail);
      return {
        taxes,
        totalTaxes,
        dueDate,
        isOverdue,
        tenant,
        propertyAddress,
        contractEnded,
        outsideMonth,
        tgiLines,
      };
    };

    return (
    <>
      <h4 className="mt-4">{title}</h4>
      {tablePeriods.length > 0 ? (
        <>
          <div className="d-lg-none">
            {tablePeriods.map((period) => {
              const {
                totalTaxes,
                dueDate,
                isOverdue,
                tenant,
                propertyAddress,
                contractEnded,
                outsideMonth,
                tgiLines,
              } = periodMeta(period);
              return (
                <Card
                  key={period.id}
                  className={`mb-3 ${isOverdue ? "border-danger" : ""}`}
                >
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <div className="fw-semibold">{tenant?.name || "Inquilino no disponible"}</div>
                        {tenant?.email && (
                          <small className="text-muted text-break-all d-block">
                            {tenant.email}
                          </small>
                        )}
                      </div>
                      <span
                        className={`badge bg-${
                          period.payment_status === "PAGADO"
                            ? "success"
                            : isOverdue
                            ? "danger"
                            : "warning"
                        }`}
                      >
                        {isOverdue ? "VENCIDO" : period.payment_status}
                      </span>
                    </div>
                    <div className="small mb-2 text-break-all">
                      <strong>Dirección:</strong> {propertyAddress}
                      {contractEnded && (
                        <span className="badge bg-dark ms-2">Contrato vencido</span>
                      )}
                      {!contractEnded && outsideMonth && (
                        <span className="badge bg-secondary ms-2">Mes anterior</span>
                      )}
                    </div>
                    {title.includes("Agencia") && (
                      <div className="small mb-2">
                        <strong>Agencia:</strong> {period.contract?.real_agency?.name || "-"}
                      </div>
                    )}
                    <div className="small mb-1">
                      <strong>Período:</strong>{" "}
                      {new Date(period.start_date).toLocaleDateString()} -{" "}
                      {new Date(period.end_date).toLocaleDateString()}
                      {period.is_prorated && (
                        <span className="badge bg-info text-dark ms-2">Proporcional</span>
                      )}
                    </div>
                    <div className="small mb-2">
                      <strong>Vencimiento:</strong>{" "}
                      {dueDate ? dueDate.toLocaleDateString("es-AR") : "—"}
                      {isOverdue && period.days_overdue > 0 && (
                        <span className="text-danger">
                          {" "}
                          ({period.days_overdue} día
                          {period.days_overdue === 1 ? "" : "s"})
                        </span>
                      )}
                    </div>
                    <div className="small mb-3">
                      Total ${period.total_amount.toLocaleString()} · Pagado $
                      {period.amount_paid.toLocaleString()}
                      {totalTaxes > 0 && ` · Impuestos $${totalTaxes.toLocaleString()}`}
                      {tgiLines.map((line) => (
                        <div key={line} className="text-muted">{line}</div>
                      ))}
                      {Number(period.late_fee_amount) > 0 &&
                        ` · Recargo $${Number(period.late_fee_amount).toLocaleString()}`}
                      {(period.contract?.last_index_value ?? period.contract?.base_index_value) != null && (
                        <>
                          {" "}
                          · IPC{" "}
                          {Number(
                            period.contract.last_index_value ??
                              period.contract.base_index_value
                          ).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                        </>
                      )}
                    </div>
                    {renderPeriodActions(period)}
                  </Card.Body>
                </Card>
              );
            })}
          </div>
          <div className="table-responsive d-none d-lg-block">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Inquilino</th>
              <th>Dirección</th>
              {title.includes("Agencia") && <th>Agencia</th>}
              <th>Periodo</th>
              <th>Vencimiento</th>
              <th>Monto Base</th>
              <th>Monto Indexado</th>
              <th>IPC</th>
              <th>Impuestos</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tablePeriods.map((period) => {
              const {
                totalTaxes,
                dueDate,
                isOverdue,
                tenant,
                propertyAddress,
                contractEnded,
                outsideMonth,
                tgiLines,
              } = periodMeta(period);

              return (
                <tr key={period.id} className={isOverdue ? "table-danger" : ""}>
                  <td>
                    {tenant ? (
                      <>
                        <div>{tenant.name}</div>
                        <small className="text-muted">{tenant.email}</small>
                      </>
                    ) : (
                      "Inquilino no disponible"
                    )}
                  </td>
                  <td>
                    {propertyAddress}
                    {contractEnded && (
                      <div>
                        <span className="badge bg-dark">Contrato vencido</span>
                      </div>
                    )}
                    {!contractEnded && outsideMonth && (
                      <div>
                        <span className="badge bg-secondary">Mes anterior</span>
                      </div>
                    )}
                  </td>
                  {title.includes("Agencia") && (
                    <td>{period.contract?.real_agency?.name || "-"}</td>
                  )}
                  <td>
                    {new Date(period.start_date).toLocaleDateString()} -{" "}
                    {new Date(period.end_date).toLocaleDateString()}
                    {period.is_prorated && (
                      <div>
                        <span className="badge bg-info text-dark">Proporcional</span>
                        {period.proration_note && (
                          <div>
                            <small className="text-muted">{period.proration_note}</small>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {dueDate ? dueDate.toLocaleDateString("es-AR") : "—"}
                    {isOverdue && period.days_overdue > 0 && (
                      <div>
                        <small className="text-danger">
                          {period.days_overdue} día
                          {period.days_overdue === 1 ? "" : "s"} de atraso
                        </small>
                      </div>
                    )}
                  </td>
                  <td>${period.base_rent.toLocaleString()}</td>
                  <td>
                    ${period.indexed_amount.toLocaleString()}
                    {period.is_prorated && (
                      <div>
                        <small className="text-muted">
                          Este mes: ${Number(period.period_rent ?? period.indexed_amount).toLocaleString()}
                        </small>
                      </div>
                    )}
                  </td>
                  <td>
                    {(period.contract?.last_index_value ??
                      period.contract?.base_index_value) != null
                      ? Number(
                          period.contract.last_index_value ??
                            period.contract.base_index_value
                        ).toLocaleString("es-AR", { maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td>
                    ${totalTaxes.toLocaleString()}
                    {tgiLines.map((line) => (
                      <small key={line} className="text-muted d-block">
                        {line}
                      </small>
                    ))}
                  </td>
                  <td>
                    ${period.total_amount.toLocaleString()}
                    {Number(period.late_fee_amount) > 0 && (
                      <div>
                        <small className="text-muted">
                          Incluye recargo $
                          {Number(period.late_fee_amount).toLocaleString()}
                        </small>
                      </div>
                    )}
                  </td>
                  <td>${period.amount_paid.toLocaleString()}</td>
                  <td>
                    <span
                      className={`badge bg-${
                        period.payment_status === "PAGADO"
                          ? "success"
                          : isOverdue
                          ? "danger"
                          : "warning"
                      }`}
                    >
                      {isOverdue ? "VENCIDO" : period.payment_status}
                    </span>
                  </td>
                  <td>{renderPeriodActions(period)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
          </div>
        </>
      ) : (
        <Alert variant="info">No hay períodos {title.toLowerCase()}.</Alert>
      )}
    </>
  );
  };

  return (
    <div>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
        <div>
          <h2 className="h4 mb-0">Contratos activos</h2>
          <p className="text-muted small mb-0 mt-1">
            El IPC se actualiza solo a mitad de mes. Cuando toque el ajuste de un contrato, usá <strong>Índice</strong> y confirmá: el alquiler no sube solo.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Nuevo contrato
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Row className="mb-3 g-3 align-items-end">
        <Col xs={6} md={2}>
          <Form.Group controlId="filterMonth">
            <Form.Label>Mes</Form.Label>
            <Form.Select
              value={filterMonth}
              disabled={showAllPending}
              onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={6} md={2}>
          <Form.Group controlId="filterYear">
            <Form.Label>Año</Form.Label>
            <Form.Select
              value={filterYear}
              disabled={showAllPending}
              onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={3}>
          <Form.Group controlId="tenantFilter">
            <Form.Label>Inquilino</Form.Label>
            <Form.Select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
            >
              <option value="all">Todos los inquilinos</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} - {tenant.email}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xs={12} md={4}>
          <Form.Label className="d-block">Estado del mes</Form.Label>
          <div className="d-flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={paymentFilter === "pending" ? "warning" : "outline-warning"}
              disabled={showAllPending}
              onClick={() => setPaymentFilter("pending")}
            >
              Pendientes
            </Button>
            <Button
              size="sm"
              variant={paymentFilter === "paid" ? "success" : "outline-success"}
              disabled={showAllPending}
              onClick={() => setPaymentFilter("paid")}
            >
              Pagados
            </Button>
            <Button
              size="sm"
              variant={paymentFilter === "all" ? "secondary" : "outline-secondary"}
              disabled={showAllPending}
              onClick={() => setPaymentFilter("all")}
            >
              Todos
            </Button>
          </div>
        </Col>
        <Col xs={12} md={3}>
          <Form.Check
            type="switch"
            id="show-all-pending"
            label="Ver todos los pendientes (sin filtro de mes)"
            checked={showAllPending}
            onChange={(e) => setShowAllPending(e.target.checked)}
          />
        </Col>
      </Row>

      {!showAllPending && (
        <p className="text-muted small mb-3">
          {paymentFilter === "paid"
            ? `Mostrando períodos pagados de ${MONTH_NAMES[filterMonth - 1]} ${filterYear}.`
            : paymentFilter === "all"
            ? `Mostrando todos los períodos de ${MONTH_NAMES[filterMonth - 1]} ${filterYear}.`
            : `Mostrando períodos pendientes de ${MONTH_NAMES[filterMonth - 1]} ${filterYear}. Los contratos vencidos y las cuotas impagas de meses anteriores aparecen primero.`}
        </p>
      )}

      <Tabs defaultActiveKey="all" className="mb-3 flex-nowrap">
        <Tab eventKey="all" title="Todos">
          {displayedPeriods.length > 0 ? (
            <PeriodsTable periods={displayedPeriods} title="Todos los períodos" />
          ) : (
            <Alert variant="info">
              {showAllPending
                ? "No hay períodos pendientes."
                : paymentFilter === "paid"
                ? `No hay períodos pagados para ${MONTH_NAMES[filterMonth - 1]} ${filterYear}.`
                : paymentFilter === "all"
                ? `No hay períodos para ${MONTH_NAMES[filterMonth - 1]} ${filterYear}.`
                : `No hay períodos pendientes para ${MONTH_NAMES[filterMonth - 1]} ${filterYear}.`}{" "}
              Podés crear un contrato o cambiar el filtro.
            </Alert>
          )}
        </Tab>
        <Tab eventKey="withAgency" title="Con Agencia">
          <PeriodsTable periods={withAgency} title="Períodos con Agencia" />
        </Tab>
        <Tab eventKey="withoutAgency" title="Sin Agencia">
          <PeriodsTable periods={withoutAgency} title="Períodos sin Agencia" />
        </Tab>
      </Tabs>

      <CreateContractModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onCreated={loadPeriods}
      />

      <PayPeriodModal
        show={showPayModal}
        onHide={() => setShowPayModal(false)}
        period={selectedPeriod}
        onPay={handlePayment}
      />

      <EditTaxesModal
        show={showTaxesModal}
        onHide={() => setShowTaxesModal(false)}
        period={selectedPeriod}
        onSave={handleTaxUpdate}
      />
      <UpdateIndexModal
        show={showIndexModal}
        onHide={() => {
          setShowIndexModal(false);
          setSelectedPeriod(null);
        }}
        contract={selectedPeriod?.contract}
        currentRent={selectedPeriod?.indexed_amount}
        onUpdate={loadPeriods}
      />
      <CancelContractModal
        show={showCancelModal}
        onHide={() => {
          setShowCancelModal(false);
          setContractToCancel(null);
        }}
        contractId={contractToCancel?.id}
        propertyLabel={contractToCancel?.property?.direction}
        onCancelled={loadPeriods}
      />
      <EditContractModal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false);
          setContractToEdit(null);
        }}
        contractId={contractToEdit?.id}
        onSaved={loadPeriods}
      />
    </div>
  );
};

export default ContractsTable;
