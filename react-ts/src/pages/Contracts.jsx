import { useEffect, useState } from "react";
import { Button, Spinner, Table, Alert, Form, Tab, Tabs, Row, Col } from "react-bootstrap";
import { getAllPendingPeriods, registerPayment, updateTaxes, getPeriodsByMonth } from "../api/contract_period";
import PayPeriodModal from "../components/PayPeriodModal";
import EditTaxesModal from "../components/EditTaxesModal";
import CreateContractModal from "../components/CreateContractModal";
import UpdateIndexModal from "../components/UpdateIndexModal";

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
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [tenants, setTenants] = useState([]);
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [showAllPending, setShowAllPending] = useState(false);

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
    } catch (err) {
      console.error("Payment error:", err);
      setError("Error al registrar el pago.");
    }
  };

  const handleTaxUpdate = async (periodId, taxData) => {
    try {
      await updateTaxes(periodId, taxData);
      loadPeriods();
      setShowTaxesModal(false);
    } catch (err) {
      console.error("Tax update error:", err);
      setError("Error al actualizar los impuestos.");
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

  const PeriodsTable = ({ periods: tablePeriods, title }) => (
    <>
      <h4 className="mt-4">{title}</h4>
      {tablePeriods.length > 0 ? (
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
              <th>Impuestos</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tablePeriods.map((period) => {
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
                period.contract?.property?.direction || "Dirección no disponible";

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
                  </td>
                  <td>{dueDate.toLocaleDateString()}</td>
                  <td>${period.base_rent.toLocaleString()}</td>
                  <td>${period.indexed_amount.toLocaleString()}</td>
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
                  <td>
                    <div className="d-flex gap-2">
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Alert variant="info">No hay períodos {title.toLowerCase()}.</Alert>
      )}
    </>
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Períodos Pendientes</h2>
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
        <Col md={2}>
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
        <Col md={2}>
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
        <Col md={3}>
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
        <Col md={3}>
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

      <Tabs defaultActiveKey="all" className="mb-3">
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
    </div>
  );
};

export default ContractsTable;
