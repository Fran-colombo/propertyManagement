
import { useEffect, useState } from "react";
import { 
  Button, 
  Spinner, 
  Table, 
  Alert, 
  ToggleButton, 
  ToggleButtonGroup,
  Form,
  Tab,
  Tabs
} from "react-bootstrap";
import { 
  getAllPendingPeriods,
  registerPayment,
  updateTaxes,
  getCurrentPendingPeriods
} from "../api/contract_period";
import PayPeriodModal from "../components/PayPeriodModal";
import EditTaxesModal from "../components/EditTaxesModal";
import CreateContractModal from "../components/CreateContractModal";
import UpdateIndexModal from "../components/UpdateIndexModal";

const ContractsTable = () => {
  const [periods, setPeriods] = useState([]);
  const [allPeriods, setAllPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showTaxesModal, setShowTaxesModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showAllPending, setShowAllPending] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    loadAllPendingPeriods();
  }, []);

  const loadAllPendingPeriods = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentPendingPeriods();
      const allData = await getAllPendingPeriods();
      
      const allTenants = [...data, ...allData]
        .map(p => p.contract?.tenant)
        .filter((t, i, arr) => t && arr.findIndex(t2 => t2.id === t.id) === i);
      
      setTenants(allTenants);
      setPeriods(data || []);
      setAllPeriods(allData || []);
    } catch (error) {
      console.error("Error al cargar los períodos pendientes:", error);
      setError("No se pudieron cargar los períodos pendientes.");
    } finally {
      setLoading(false);
    }
  };

  const toggleShowAllPending = () => {
    setShowAllPending(!showAllPending);
  };

  const handlePayment = async (periodId, paymentData) => {
    try {
      await registerPayment(periodId, paymentData);
      loadAllPendingPeriods();
      setShowPayModal(false);
    } catch (error) {
      console.error("Payment error:", error);
      setError("Error al registrar el pago.");
    }
  };

  const handleTaxUpdate = async (periodId, taxData) => {
    try {
      await updateTaxes(periodId, taxData);
      loadAllPendingPeriods();
      setShowTaxesModal(false);
    } catch (error) {
      console.error("Tax update error:", error);
      setError("Error al actualizar los impuestos.");
    }
  };

  const getFilteredPeriods = () => {
    let filtered = showAllPending ? allPeriods : periods;
    
    if (selectedTenant !== "all") {
      const tenantId = parseInt(selectedTenant);
      filtered = filtered.filter(p => p.contract?.tenant?.id === tenantId);
    }
    
    return filtered;
  };

  const splitPeriodsByAgency = (periods) => {
    return periods.reduce((acc, period) => {
      if (period.contract?.real_agency) {
        acc.withAgency.push(period);
      } else {
        acc.withoutAgency.push(period);
      }
      return acc;
    }, { withAgency: [], withoutAgency: [] });
  };

  if (loading) return <Spinner animation="border" className="m-5" />;
  if (error) return <Alert variant="danger" className="m-3">{error}</Alert>;

  const displayedPeriods = getFilteredPeriods();
  const { withAgency, withoutAgency } = splitPeriodsByAgency(displayedPeriods);

  const PeriodsTable = ({ periods, title }) => (
    <>
      <h4 className="mt-4">{title}</h4>
      {periods.length > 0 ? (
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
            {periods.map((period) => {
              const taxes = period.taxes || {};
              const totalTaxes = (taxes.epe || 0) + (taxes.tgi || 0) + 
                               (taxes.api || 0) + (taxes.fire_insurance || 0);
              const dueDate = new Date(period.due_date);
              const isOverdue = dueDate < new Date() && period.payment_status !== "PAGADO";
              const tenant = period.contract?.tenant;
              const propertyAddress = period.contract?.property?.direction || "Dirección no disponible";

              return (
                <tr key={period.id} className={isOverdue ? "table-danger" : ""}>
                  <td>
                    {tenant ? (
                      <>
                        <div>{tenant.name}</div>
                        <small className="text-muted">{tenant.email}</small>
                      </>
                    ) : "Inquilino no disponible"}
                  </td>
                  <td>{propertyAddress}</td>
                  {title.includes("Agencia") && (
                    <td>{period.contract?.real_agency?.name || '-'}</td>
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
                    <span className={`badge bg-${
                      period.payment_status === "PAGADO" ? "success" :
                      isOverdue ? "danger" : "warning"
                    }`}>
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
        <div>
          <ToggleButtonGroup type="checkbox" className="me-2">
            <ToggleButton
              id="toggle-all"
              variant={showAllPending ? "primary" : "outline-primary"}
              value={1}
              onChange={toggleShowAllPending}
            >
              {showAllPending ? "Mostrar actuales" : "Mostrar todos"}
            </ToggleButton>
          </ToggleButtonGroup>
          <Button 
              variant="info" 
              className="me-2"
              onClick={() => setShowIndexModal(true)}
            >
              Editar Índices
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Nuevo contrato
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-3">
        <Form.Group controlId="tenantFilter" className="w-25">
          <Form.Label>Filtrar por inquilino:</Form.Label>
          <Form.Select 
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
          >
            <option value="all">Todos los inquilinos</option>
            {tenants.map(tenant => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} - {tenant.email}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </div>

      {/* Tabs para alternar entre vistas */}
      <Tabs defaultActiveKey="all" className="mb-3">
        <Tab eventKey="all" title="Todos">
          {displayedPeriods.length > 0 ? (
            <PeriodsTable periods={displayedPeriods} title="Todos los períodos" />
          ) : (
            <Alert variant="info">No hay períodos pendientes.</Alert>
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
        onCreated={loadAllPendingPeriods}
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
        onHide={() => setShowIndexModal(false)}
        onUpdate={loadAllPendingPeriods} 
      />
    </div>
  );
};

export default ContractsTable;