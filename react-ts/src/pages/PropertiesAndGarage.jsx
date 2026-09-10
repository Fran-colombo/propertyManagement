import { useEffect, useMemo, useState } from "react";
import { Card, Spinner, Row, Col, Badge, Button, Modal, Table, Alert, Form, Pagination } from "react-bootstrap";
import { apiFetch } from "../api/clients";
import { deleteProperty } from "../api/property";
import { getPeriodsByContract } from "../api/contract_period";
import CreatePropertyModal from "../components/CreatePropertyModal";
import CreateGarageModal from "../components/CreateGarageModal";
import CancelContractModal from "../components/CancelContractModal";
import EditContractModal from "../components/EditContractModal";
import SellPropertyModal from "../components/SellPropertyModal";
import FeedbackModal from "../components/FeedbackModal";
import { mediaUrl } from "../utils/mediaUrl";
import {
  openCashReceiptPrint,
  saleInstallmentConcept,
  saleReceiptDates,
  rentPeriodConcept,
} from "../utils/cashReceipt";

const OCCUPANCY_ALL = "all";
const OCCUPANCY_RENTED = "rented";
const OCCUPANCY_AVAILABLE = "available";
const PAGE_SIZE = 12;

function matchesOccupancy(isRented, filter) {
  if (filter === OCCUPANCY_RENTED) return isRented;
  if (filter === OCCUPANCY_AVAILABLE) return !isRented;
  return true;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesText(haystack, term) {
  if (!term) return true;
  return normalizeSearch(haystack).includes(term);
}

function propertySearchBlob(p) {
  return [
    p.direction,
    p.floor,
    p.apartment,
    p.owner?.name,
    p.rental_contract?.tenant?.name,
  ]
    .filter(Boolean)
    .join(" ");
}

function garageSearchBlob(g) {
  return [g.number, g.owner_name, g.property_direction, g.tenant_name]
    .filter(Boolean)
    .join(" ");
}

function pageWindow(page, pages) {
  const items = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(pages, windowStart + 4);
  for (let p = windowStart; p <= windowEnd; p += 1) items.push(p);
  return items;
}

function ListPagination({ page, pages, total, label, onChange }) {
  if (total === 0) return null;
  return (
    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mt-2">
      <small className="text-muted">
        {total} {label}
        {total === 1 ? "" : "s"}
      </small>
      {pages > 1 && (
        <Pagination className="mb-0">
          <Pagination.Prev
            disabled={page <= 1}
            onClick={() => onChange(Math.max(1, page - 1))}
          />
          {pageWindow(page, pages).map((p) => (
            <Pagination.Item key={p} active={p === page} onClick={() => onChange(p)}>
              {p}
            </Pagination.Item>
          ))}
          <Pagination.Next
            disabled={page >= pages}
            onClick={() => onChange(Math.min(pages, page + 1))}
          />
        </Pagination>
      )}
    </div>
  );
}

const PropertiesAndGarages = () => {
  const [properties, setProperties] = useState([]);
  const [garages, setGarages] = useState([]);
  const [propertyOccupancy, setPropertyOccupancy] = useState(OCCUPANCY_ALL);
  const [garageOccupancy, setGarageOccupancy] = useState(OCCUPANCY_ALL);
  const [propertySearch, setPropertySearch] = useState("");
  const [garageSearch, setGarageSearch] = useState("");
  const [propertyPage, setPropertyPage] = useState(1);
  const [garagePage, setGaragePage] = useState(1);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editingGarage, setEditingGarage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPeriodsModal, setShowPeriodsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGarageModal, setShowCreateGarageModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [contractToCancel, setContractToCancel] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contractToEdit, setContractToEdit] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [pendingDeleteProp, setPendingDeleteProp] = useState(null);
  const [propertyToSell, setPropertyToSell] = useState(null);


  const findCurrentPeriod = (periods) => {
    if (!periods) return null;
    const today = new Date();
    return periods.find(period => {
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      return startDate <= today && today <= endDate;
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [propertiesData, garagesData] = await Promise.all([
        apiFetch("/properties/"),
        apiFetch("/garages/")
      ]);

      const propertiesList = propertiesData || [];
      const garagesList = garagesData || [];

      const processedProperties = propertiesList.map(property => {
        const currentPeriod = property.rental_contract 
          ? findCurrentPeriod(property.rental_contract.periods)
          : null;

        return {
          ...property,
          currentPeriod,
          monthlyPayment: currentPeriod ? {
            taxes: {
              epe: currentPeriod.taxes?.epe || 0,
              tgi: currentPeriod.taxes?.tgi || 0,
              api: currentPeriod.taxes?.api || 0,
              fire_insurance: currentPeriod.taxes?.fire_insurance || 0
            },
            total: currentPeriod.total_amount
          } : null
        };
      });

      setProperties(processedProperties);
      setGarages(garagesList);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Error al cargar los datos. Por favor intenta nuevamente.");
      setProperties([]);
      setGarages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProperties = useMemo(() => {
    const term = normalizeSearch(propertySearch);
    return properties.filter(
      (p) =>
        matchesOccupancy(Boolean(p.rental_contract), propertyOccupancy) &&
        matchesText(propertySearchBlob(p), term)
    );
  }, [properties, propertyOccupancy, propertySearch]);

  const filteredGarages = useMemo(() => {
    const term = normalizeSearch(garageSearch);
    return garages.filter(
      (g) =>
        matchesOccupancy(Boolean(g.rental_contract_id), garageOccupancy) &&
        matchesText(garageSearchBlob(g), term)
    );
  }, [garages, garageOccupancy, garageSearch]);

  const propertyPages = Math.max(1, Math.ceil(filteredProperties.length / PAGE_SIZE));
  const garagePages = Math.max(1, Math.ceil(filteredGarages.length / PAGE_SIZE));
  const pagedProperties = filteredProperties.slice(
    (Math.min(propertyPage, propertyPages) - 1) * PAGE_SIZE,
    Math.min(propertyPage, propertyPages) * PAGE_SIZE
  );
  const pagedGarages = filteredGarages.slice(
    (Math.min(garagePage, garagePages) - 1) * PAGE_SIZE,
    Math.min(garagePage, garagePages) * PAGE_SIZE
  );

  useEffect(() => {
    setPropertyPage(1);
  }, [propertyOccupancy, propertySearch]);

  useEffect(() => {
    setGaragePage(1);
  }, [garageOccupancy, garageSearch]);

  useEffect(() => {
    setPropertyPage((p) => Math.min(p, propertyPages));
  }, [propertyPages]);

  useEffect(() => {
    setGaragePage((p) => Math.min(p, garagePages));
  }, [garagePages]);

  const occupancyEmptyMessage = (kind, filter, hasAny, searching) => {
    if (searching) {
      return kind === "propiedad"
        ? "No hay propiedades que coincidan con la búsqueda."
        : "No hay garages que coincidan con la búsqueda.";
    }
    if (!hasAny) {
      return kind === "propiedad"
        ? "No tenés propiedades todavía. Podés crear una con el botón de arriba."
        : "No hay garages todavía. Podés crear uno con el botón de arriba.";
    }
    if (filter === OCCUPANCY_RENTED) {
      return kind === "propiedad"
        ? "No hay propiedades alquiladas."
        : "No hay garages alquilados.";
    }
    if (filter === OCCUPANCY_AVAILABLE) {
      return kind === "propiedad"
        ? "No hay propiedades disponibles."
        : "No hay garages disponibles.";
    }
    return kind === "propiedad"
      ? "No hay propiedades para mostrar."
      : "No hay garages para mostrar.";
  };

  const handleDeleteProperty = async (propertyId) => {
  try {
    const response = await deleteProperty(propertyId);
    if (response.message) {
      loadData();
      setFeedback({
        variant: "success",
        title: "Propiedad eliminada",
        message: response.message,
      });
    }
  } catch (error) {
    console.error("Error deleting property:", error);
    setFeedback({
      variant: "danger",
      title: "Error",
      message: error.message || "Error al eliminar la propiedad",
    });
  } finally {
    setPendingDeleteProp(null);
  }
};

  const openPropertyPayments = (prop) => {
    setSelectedPayment({
      title: prop.direction,
      tenantName: prop.rental_contract?.tenant?.name,
      periods: prop.rental_contract?.periods || [],
      currentPeriodId: prop.currentPeriod?.id,
      contract: prop.rental_contract,
      floor: prop.floor,
      apartment: prop.apartment,
      direction: prop.direction,
      garageLabel: prop.rental_contract?.garage_label,
    });
    setShowPeriodsModal(true);
  };

  const openGaragePayments = async (garage) => {
    if (!garage.rental_contract_id) return;
    setLoadingPeriods(true);
    setShowPeriodsModal(true);
    setSelectedPayment({
      title: `Garage N° ${garage.number}`,
      tenantName: garage.tenant_name,
      periods: [],
      currentPeriodId: null,
      contract: null,
      floor: null,
      apartment: null,
      direction: garage.property_direction || `Garage N° ${garage.number}`,
      garageLabel: `Garage N° ${garage.number}`,
    });
    try {
      const periods = await getPeriodsByContract(garage.rental_contract_id);
      const current = findCurrentPeriod(periods);
      const contract = periods?.[0]?.contract || null;
      setSelectedPayment({
        title: `Garage N° ${garage.number}`,
        tenantName:
          garage.tenant_name || contract?.tenant?.name || "Sin inquilino",
        periods: periods || [],
        currentPeriodId: current?.id,
        contract,
        floor: null,
        apartment: null,
        direction: garage.property_direction || `Garage N° ${garage.number}`,
        garageLabel: `Garage N° ${garage.number}`,
      });
    } catch (err) {
      console.error("Error loading garage periods:", err);
      setError("No se pudieron cargar los períodos del garage.");
    } finally {
      setLoadingPeriods(false);
    }
  };

  const PropertyCard = ({ prop }) => (
    <Card className="mb-3 h-100">
      <Card.Body>
        <Card.Title>{prop.direction}</Card.Title>
        <Card.Subtitle className="mb-2 text-muted">
          Dueño: {prop.owner?.name || "Sin dueño"}
        </Card.Subtitle>
        <p className="mb-1">
          {prop.floor && (
            <>
              <strong>Piso:</strong> {prop.floor}{" "}
            </>
          )}
          {prop.apartment && (
            <>
              <strong>Depto:</strong> {prop.apartment}
            </>
          )}
          {!prop.floor && !prop.apartment && (
            <span className="text-muted">Sin piso/departamento</span>
          )}
        </p>
        <Button
          variant="outline-secondary"
          size="sm"
          className="mb-2 me-2"
          onClick={() => setEditingProperty(prop)}
        >
          Editar
        </Button>
        <Button
          variant="outline-success"
          size="sm"
          className="mb-2 me-2"
          onClick={() => setPropertyToSell(prop)}
        >
          Vender
        </Button>
        <Button
          variant="outline-danger"
          size="sm"
          className="mb-2"
          onClick={() => setPendingDeleteProp(prop)}
        >
          Eliminar
        </Button>
        {prop.rental_contract ? (
          <>
            <p>
              Inquilino:{" "}
              <strong>{prop.rental_contract.tenant?.name || "Sin inquilino"}</strong>
            </p>
            <p>
              Contrato hasta:{" "}
              <strong>
                {prop.rental_contract.end_date
                  ? new Date(prop.rental_contract.end_date).toLocaleDateString()
                  : "Sin fecha"}
              </strong>
            </p>

            {prop.currentPeriod && (
              <>
                <p>
                  Período actual:{" "}
                  <Badge
                    bg={
                      prop.currentPeriod.payment_status === "PAGADO"
                        ? "success"
                        : "warning"
                    }
                  >
                    {prop.currentPeriod.payment_status || "PENDIENTE"} - $
                    {prop.monthlyPayment?.total.toLocaleString()}
                  </Badge>
                </p>
                <p>
                  Del {new Date(prop.currentPeriod.start_date).toLocaleDateString()} al{" "}
                  {new Date(prop.currentPeriod.end_date).toLocaleDateString()}
                  {prop.currentPeriod.is_prorated && (
                    <>
                      {" "}
                      <Badge bg="info" text="dark">Proporcional</Badge>
                    </>
                  )}
                </p>
              </>
            )}

            <div className="d-flex flex-wrap gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => openPropertyPayments(prop)}
              >
                Ver Detalles de Pagos
              </Button>
              {prop.rental_contract.document_path && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  as="a"
                  href={mediaUrl(prop.rental_contract.document_path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver contrato
                </Button>
              )}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setContractToEdit(prop.rental_contract);
                  setShowEditModal(true);
                }}
              >
                Editar contrato
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => {
                  setContractToCancel(prop.rental_contract);
                  setShowCancelModal(true);
                }}
              >
                Finalizar contrato
              </Button>
            </div>
          </>
        ) : (
          <p>
            {prop.management_status === "DELIVERED" ? (
              <Badge bg="info">Entregada</Badge>
            ) : (
              <Badge bg="success">Disponible</Badge>
            )}
          </p>
        )}

        {prop.garages?.length > 0 && (
          <div className="mt-2">
            <strong>Garage(s):</strong>
            {prop.garages.map((g) => (
              <Badge
                key={g.id}
                bg={g.rental_contract_id ? "secondary" : "info"}
                className="me-1"
              >
                N° {g.number}{" "}
                {g.rental_contract_id ? "(alquilado)" : "(libre / separable)"}
              </Badge>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const GarageCard = ({ garage }) => (
    <Card className="mb-3 h-100">
      <Card.Body className="d-flex flex-column">
        <Card.Title>Garage N° {garage.number}</Card.Title>
        <Card.Subtitle className="mb-2 text-muted">
          Dueño: {garage.owner_name || "Sin dueño"}
        </Card.Subtitle>
        {garage.property_direction ? (
          <p className="mb-2">
            Asociado a: <strong>{garage.property_direction}</strong>
            <br />
            <small className="text-muted">Puede alquilarse por separado</small>
          </p>
        ) : (
          <p className="mb-2 text-muted">Sin propiedad asociada</p>
        )}
        {garage.rental_contract_id ? (
          <p className="mb-2">
            Inquilino: <strong>{garage.tenant_name || "Sin inquilino"}</strong>
          </p>
        ) : null}
        <Badge
          bg={garage.rental_contract_id ? "secondary" : "info"}
          className="mt-auto align-self-start mb-2"
        >
          {garage.rental_contract_id ? "Alquilado" : "Disponible para alquilar"}
        </Badge>
        <div className="d-flex flex-wrap gap-2">
          {garage.rental_contract_id && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => openGaragePayments(garage)}
            >
              Ver Detalles de Pagos
            </Button>
          )}
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setEditingGarage(garage)}
          >
            Editar
          </Button>
        </div>
      </Card.Body>
    </Card>
  );

  if (loading && properties.length === 0 && garages.length === 0) {
    return <Spinner animation="border" className="m-5" />;
  }

  return (
    <div>
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <section className="mb-5">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
            <h2 className="h4 mb-0">Propiedades</h2>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Form.Control
                type="search"
                placeholder="Buscar por dirección, dueño o inquilino"
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                style={{ minWidth: "220px" }}
                aria-label="Buscar propiedades"
              />
              <Form.Select
                value={propertyOccupancy}
                onChange={(e) => setPropertyOccupancy(e.target.value)}
                style={{ width: "auto" }}
                aria-label="Filtrar propiedades"
              >
                <option value={OCCUPANCY_ALL}>Todos</option>
                <option value={OCCUPANCY_RENTED}>Alquilados</option>
                <option value={OCCUPANCY_AVAILABLE}>Disponibles</option>
              </Form.Select>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                + Nueva Propiedad
              </Button>
            </div>
          </div>

        {filteredProperties.length === 0 ? (
          <Alert variant="info">
            {occupancyEmptyMessage(
              "propiedad",
              propertyOccupancy,
              properties.length > 0,
              Boolean(propertySearch.trim())
            )}
          </Alert>
        ) : (
          <>
          <Row xs={1} md={2} lg={3}>
            {pagedProperties.map(prop => (
              <Col key={prop.id} className="mb-4">
                <PropertyCard prop={prop} />
              </Col>
            ))}
          </Row>
          <ListPagination
            page={Math.min(propertyPage, propertyPages)}
            pages={propertyPages}
            total={filteredProperties.length}
            label="propiedad"
            onChange={setPropertyPage}
          />
          </>
        )}
      </section>

      <section>
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
        <h2 className="h4 mb-0">Garages</h2>

        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Form.Control
            type="search"
            placeholder="Buscar por número, dueño o dirección"
            value={garageSearch}
            onChange={(e) => setGarageSearch(e.target.value)}
            style={{ minWidth: "220px" }}
            aria-label="Buscar garages"
          />
          <Form.Select
            value={garageOccupancy}
            onChange={(e) => setGarageOccupancy(e.target.value)}
            style={{ width: "auto" }}
            aria-label="Filtrar garages"
          >
            <option value={OCCUPANCY_ALL}>Todos</option>
            <option value={OCCUPANCY_RENTED}>Alquilados</option>
            <option value={OCCUPANCY_AVAILABLE}>Disponibles</option>
          </Form.Select>
          <Button variant="outline-primary" onClick={() => setShowCreateGarageModal(true)}>
            + Nuevo Garage
          </Button>
        </div>
      </div>
        {filteredGarages.length === 0 ? (
          <Alert variant="info">
            {occupancyEmptyMessage(
              "garage",
              garageOccupancy,
              garages.length > 0,
              Boolean(garageSearch.trim())
            )}
          </Alert>
        ) : (
          <>
          <Row xs={1} md={2} lg={3}>
            {pagedGarages.map(garage => (
              <Col key={garage.id} className="mb-4">
                <GarageCard garage={garage} />
              </Col>
            ))}
          </Row>
          <ListPagination
            page={Math.min(garagePage, garagePages)}
            pages={garagePages}
            total={filteredGarages.length}
            label="garage"
            onChange={setGaragePage}
          />
          </>
        )}
      </section>
      <Modal 
        show={showPeriodsModal} 
        onHide={() => {
          setShowPeriodsModal(false);
          setSelectedPayment(null);
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Detalles de Pagos - {selectedPayment?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingPeriods ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : selectedPayment?.periods?.length ? (
            <>
              <h5>Inquilino: {selectedPayment.tenantName || "Sin inquilino"}</h5>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Alquiler</th>
                    <th>Impuestos</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPayment.periods.map(period => {
                    const taxes = period.taxes || {};
                    const totalTaxes = (taxes.epe || 0) + (taxes.tgi || 0) + (taxes.api || 0) + (taxes.fire_insurance || 0);
                    const total = period.total_amount ?? ((period.period_rent ?? period.indexed_amount) + totalTaxes);
                    
                    return (
                      <tr 
                        key={period.id}
                        className={period.id === selectedPayment.currentPeriodId ? 'table-primary' : ''}
                      >
                        <td>
                          {new Date(period.start_date).toLocaleDateString()} - {' '}
                          {new Date(period.end_date).toLocaleDateString()}
                          {period.is_prorated && (
                            <div>
                              <Badge bg="info" text="dark">Proporcional</Badge>
                              {period.proration_note && (
                                <div>
                                  <small className="text-muted">{period.proration_note}</small>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          ${Number(period.period_rent ?? period.indexed_amount).toLocaleString()}
                          {period.is_prorated && (
                            <div>
                              <small className="text-muted">
                                Mensual: ${Number(period.indexed_amount || 0).toLocaleString()}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          <small>
                            EPE: ${(taxes.epe || 0).toLocaleString()}<br />
                            TGI: ${(taxes.tgi || 0).toLocaleString()}<br />
                            API: ${(taxes.api || 0).toLocaleString()}<br />
                            Seguro: ${(taxes.fire_insurance || 0).toLocaleString()}
                          </small>
                        </td>
                        <td>${total.toLocaleString()}</td>
                        <td>
                          <Badge
                            bg={
                              period.payment_status === "PAGADO"
                                ? "success"
                                : period.payment_status === "CONTRATO_TERMINADO"
                                ? "danger"
                                : "warning"
                            }
                          >
                            {period.payment_status}
                          </Badge>
                          {period.payment_status === "PAGADO" && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => {
                                  const contract = selectedPayment.contract;
                                  const periods = selectedPayment.periods || [];
                                  try {
                                    openCashReceiptPrint({
                                        payerName: selectedPayment.tenantName || contract?.tenant?.name,
                                        amount: period.amount_paid || total,
                                        currency: contract?.currency,
                                        concept: rentPeriodConcept(periods, period.id),
                                        floor: selectedPayment.floor,
                                        apartment: selectedPayment.apartment,
                                        direction: selectedPayment.direction,
                                        garageLabel: selectedPayment.garageLabel || contract?.garage_label,
                                        periodDate: period.start_date,
                                        issuedAt: period.payment_date || period.start_date,
                                      });
                                  } catch (err) {
                                    window.alert(err.message || "No se pudo generar el comprobante.");
                                  }
                                }}
                              >
                                Generar comprobante
                              </Button>
                            </div>
                          )}
                          {period.termination_note && (
                            <div>
                              <small className="text-muted">{period.termination_note}</small>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          ) : (
            <Alert variant="info" className="mb-0">
              No hay períodos para este contrato.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowPeriodsModal(false);
            setSelectedPayment(null);
          }}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
      <CreatePropertyModal 
          show={showCreateModal || !!editingProperty}
          onHide={() => {
            setShowCreateModal(false);
            setEditingProperty(null);
          }}
          onCreated={loadData}
          property={editingProperty}
        />
        <CreateGarageModal 
          show={showCreateGarageModal || !!editingGarage}
          onHide={() => {
            setShowCreateGarageModal(false);
            setEditingGarage(null);
          }}
          onCreated={loadData}
          garage={editingGarage}
        />
      <CancelContractModal
        show={showCancelModal}
        onHide={() => {
          setShowCancelModal(false);
          setContractToCancel(null);
        }}
        contractId={contractToCancel?.id}
        propertyLabel={
          contractToCancel?.property?.direction ||
          properties.find((p) => p.rental_contract?.id === contractToCancel?.id)?.direction
        }
        onCancelled={loadData}
      />
      <EditContractModal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false);
          setContractToEdit(null);
        }}
        contractId={contractToEdit?.id}
        onSaved={loadData}
      />
      <SellPropertyModal
        show={!!propertyToSell}
        onHide={() => setPropertyToSell(null)}
        property={propertyToSell}
        onSold={(result) => {
          const sale = result?.sale;
          const method = String(result?.method || "").toLowerCase();
          const paidRows = result?.paidRows || [];
          const cashPaid = method === "efectivo" && paidRows.length > 0 && sale;
          setFeedback({
            variant: "success",
            title: "Venta registrada",
            message: "La venta se guardó. Podés ver cuotas en Ventas y el cobro en Transacciones.",
            receipt: cashPaid
              ? {
                  sale,
                  paidRows,
                }
              : null,
          });
          loadData();
        }}
      />
      <Modal show={!!pendingDeleteProp} onHide={() => setPendingDeleteProp(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          ¿Eliminar la propiedad <strong>{pendingDeleteProp?.direction}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setPendingDeleteProp(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => pendingDeleteProp && handleDeleteProperty(pendingDeleteProp.id)}
          >
            Eliminar
          </Button>
        </Modal.Footer>
      </Modal>
      <FeedbackModal
        show={!!feedback}
        variant={feedback?.variant}
        title={feedback?.title}
        message={feedback?.message}
        onGenerateReceipt={
          feedback?.receipt
            ? () => {
                const { sale, paidRows } = feedback.receipt;
                const totalCash = (paidRows || []).reduce(
                  (sum, row) => sum + Number(row.amount || 0),
                  0
                );
                const first = paidRows?.[0];
                const inst =
                  (sale.installments || []).find(
                    (row) =>
                      String(row.kind || "cuota") === String(first?.kind || "cuota") &&
                      Math.abs(Number(row.amount) - Number(first?.amount || 0)) < 0.02
                  ) || sale.installments?.[0];
                const concept =
                  (paidRows || []).length > 1
                    ? "pago de venta"
                    : saleInstallmentConcept(sale, inst);
                const dates = saleReceiptDates(sale, inst);
                openCashReceiptPrint({
                    payerName: sale.buyer_name,
                    amount: totalCash,
                    currency: sale.currency,
                    concept,
                    floor: sale.property_floor,
                    apartment: sale.property_apartment,
                    direction: sale.property_address || sale.property_direction,
                    periodDate: dates.periodDate,
                    issuedAt: dates.issuedAt,
                  });
              }
            : undefined
        }
        onClose={() => setFeedback(null)}
      />

    </div>
  );
};

export default PropertiesAndGarages;