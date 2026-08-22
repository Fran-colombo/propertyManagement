import { useEffect, useState } from "react";
import { Card, Spinner, Row, Col, Badge, Button, Modal, Table, Alert } from "react-bootstrap";
import { apiFetch } from "../api/clients";
import { deleteProperty } from "../api/property";
import CreatePropertyModal from "../components/CreatePropertyModal";
import CreateGarageModal from "../components/CreateGarageModal";
import CancelContractModal from "../components/CancelContractModal";
import EditContractModal from "../components/EditContractModal";
import { mediaUrl } from "../utils/mediaUrl";

const PropertiesAndGarages = () => {
  const [properties, setProperties] = useState([]);
  const [garageAlone, setGarageAlone] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPeriodsModal, setShowPeriodsModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGarageModal, setShowCreateGarageModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [contractToCancel, setContractToCancel] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contractToEdit, setContractToEdit] = useState(null);


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
      // Free garages: not rented — even if linked to a property (rentable separately)
      const rentableGarages = garagesList.filter((g) => !g.rental_contract_id);

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
      setGarageAlone(rentableGarages);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Error al cargar los datos. Por favor intenta nuevamente.");
      setProperties([]);
      setGarageAlone([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteProperty = async (propertyId) => {
  try {
    const response = await deleteProperty(propertyId);
    if (response.message) {
      loadData();
      alert(response.message);
    }
  } catch (error) {
    console.error("Error deleting property:", error);
    alert(`Error al eliminar propiedad: ${error.message}`);
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
          variant="outline-danger"
          size="sm"
          className="mb-2"
          onClick={() => {
            if (window.confirm(`¿Eliminar la propiedad ${prop.direction}?`)) {
              handleDeleteProperty(prop.id);
            }
          }}
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
                onClick={() => {
                  setSelectedProperty(prop);
                  setShowPeriodsModal(true);
                }}
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
            <Badge bg="success">Disponible</Badge>
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
        <Badge
          bg={garage.rental_contract_id ? "secondary" : "info"}
          className="mt-auto align-self-start"
        >
          {garage.rental_contract_id ? "Alquilado" : "Disponible para alquilar"}
        </Badge>
      </Card.Body>
    </Card>
  );

  if (loading) return <Spinner animation="border" className="m-5" />;

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
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              + Nueva Propiedad
            </Button>
          </div>

        {properties.length === 0 ? (
          <Alert variant="info">
            No tenés propiedades todavía. Podés crear una con el botón de arriba.
          </Alert>
        ) : (
          <Row xs={1} md={2} lg={3}>
            {properties.map(prop => (
              <Col key={prop.id} className="mb-4">
                <PropertyCard prop={prop} />
              </Col>
            ))}
          </Row>
        )}
      </section>

      <section>
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
        <h2 className="h4 mb-0">Garages para alquilar</h2>

        <Button variant="outline-primary" onClick={() => setShowCreateGarageModal(true)}>
          + Nuevo Garage
        </Button>
      </div>
        {garageAlone.length === 0 ? (
          <Alert variant="info">
            No hay garages libres para alquilar. Podés crear uno con el botón de arriba.
          </Alert>
        ) : (
          <Row xs={1} md={2} lg={3}>
            {garageAlone.map(garage => (
              <Col key={garage.id} className="mb-4">
                <GarageCard garage={garage} />
              </Col>
            ))}
          </Row>
        )}
      </section>
      <Modal 
        show={showPeriodsModal} 
        onHide={() => setShowPeriodsModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Detalles de Pagos - {selectedProperty?.direction}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedProperty?.rental_contract?.periods && (
            <>
              <h5>Inquilino: {selectedProperty.rental_contract.tenant?.name}</h5>
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
                  {selectedProperty.rental_contract.periods.map(period => {
                    const taxes = period.taxes || {};
                    const totalTaxes = (taxes.epe || 0) + (taxes.tgi || 0) + (taxes.api || 0) + (taxes.fire_insurance || 0);
                    const total = period.total_amount ?? ((period.period_rent ?? period.indexed_amount) + totalTaxes);
                    
                    return (
                      <tr 
                        key={period.id}
                        className={period.id === selectedProperty.currentPeriod?.id ? 'table-primary' : ''}
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
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPeriodsModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
      <CreatePropertyModal 
          show={showCreateModal}
          onHide={() => setShowCreateModal(false)}
          onCreated={loadData}
        />
        <CreateGarageModal 
          show={showCreateGarageModal}
          onHide={() => setShowCreateGarageModal(false)}
          onCreated={loadData}
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

    </div>
  );
};

export default PropertiesAndGarages;