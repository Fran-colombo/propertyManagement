import { useEffect, useState } from "react";
import { Button, Spinner, Table, Alert, Form, Tab, Tabs, Row, Col, Card } from "react-bootstrap";
import { getAllPendingPeriods, registerPayment, updateTaxes, getPeriodsByMonth } from "../api/contract_period";
import PayPeriodModal from "../components/PayPeriodModal";
import EditTaxesModal from "../components/EditTaxesModal";
import CreateContractModal from "../components/CreateContractModal";
import UpdateIndexModal from "../components/UpdateIndexModal";
import CancelContractModal from "../components/CancelContractModal";
import EditContractModal from "../components/EditContractModal";
import FeedbackModal from "../components/FeedbackModal";
import { mediaUrl } from "../utils/mediaUrl";

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
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadPeriods();
  }, [filterYear, filterMonth, showAllPending]);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = showAllPending
        ? await getAllPendingPeriods()
        : await getPeriodsByMonth(filterYear, filterMonth);

      const list = (data || []).slice().sort((a, b) => {
        const da = new Date(a.due_date || a.start_date);
        const db = new Date(b.due_date || b.start_date);
        return da - db;
      });

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
    try {
      await registerPayment(periodId, paymentData);
      loadPeriods();
      setShowPayModal(false);
      setFeedback({
        variant: "success",
        title: "Pago registrado",
        message: "El pago se registró correctamente.",
      });
    } catch (err) {
      console.error("Payment error:", err);
      setShowPayModal(false);
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "Error al registrar el pago.",
      });
    }
  };

  const handleTaxUpdate = async (periodId, taxData) => {
    try {
      await updateTaxes(periodId, taxData);
      loadPeriods();
      setShowTaxesModal(false);
      setFeedback({
        variant: "success",
        title: "Impuestos actualizados",
        message: "Los impuestos se guardaron correctamente.",
      });
    } catch (err) {
      console.error("Tax update error:", err);
      setShowTaxesModal(false);
      setFeedback({
        variant: "danger",
        title: "Error",
        message: err.message || "Error al actualizar los impuestos.",
      });
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

  if (loading) return <Spinner animation="border" className="m-5" />;

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
      const dueDate = new Date(period.due_date);
      const isOverdue =
        dueDate < new Date() && period.payment_status !== "PAGADO";
      const tenant = period.contract?.tenant;
      const propertyAddress =
        period.contract?.property?.direction ||
        period.contract?.garage_label ||
        "Dirección no disponible";
      return { taxes, totalTaxes, dueDate, isOverdue, tenant, propertyAddress };
    };

    return (
    <>
      <h4 className="mt-4">{title}</h4>
      {tablePeriods.length > 0 ? (
        <>
          <div className="d-lg-none">
            {tablePeriods.map((period) => {
              const { totalTaxes, dueDate, isOverdue, tenant, propertyAddress } =
                periodMeta(period);
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
                      <strong>Vencimiento:</strong> {dueDate.toLocaleDateString()}
                    </div>
                    <div className="small mb-3">
                      Total ${period.total_amount.toLocaleString()} · Pagado $
                      {period.amount_paid.toLocaleString()}
                      {totalTaxes > 0 && ` · Impuestos $${totalTaxes.toLocaleString()}`}
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
              const { totalTaxes, dueDate, isOverdue, tenant, propertyAddress } =
                periodMeta(period);

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
                  <td>{propertyAddress}</td>
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
                  <td>{dueDate.toLocaleDateString()}</td>
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
                  <td>${totalTaxes.toLocaleString()}</td>
                  <td>${period.total_amount.toLocaleString()}</td>
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
          <h2 className="h4 mb-0">Períodos Pendientes</h2>
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
          Mostrando períodos de {MONTH_NAMES[filterMonth - 1]} {filterYear}, ordenados por vencimiento.
          No se listan períodos de otros meses.
        </p>
      )}

      <Tabs defaultActiveKey="all" className="mb-3 flex-nowrap overflow-auto">
        <Tab eventKey="all" title="Todos">
          {displayedPeriods.length > 0 ? (
            <PeriodsTable periods={displayedPeriods} title="Todos los períodos" />
          ) : (
            <Alert variant="info">
              No hay períodos pendientes
              {!showAllPending
                ? ` para ${MONTH_NAMES[filterMonth - 1]} ${filterYear}`
                : ""}
              . Podés crear un contrato o cambiar el filtro de fecha.
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
      <FeedbackModal
        show={!!feedback}
        variant={feedback?.variant}
        title={feedback?.title}
        message={feedback?.message}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
};

export default ContractsTable;
