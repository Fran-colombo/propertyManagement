import { useEffect, useState } from "react";
import { getContractHistory } from "../api/contract";
import { getPeriodsByContract } from "../api/contract_period";
import { getProperties } from "../api/property";
import { Table, Button, Modal, Badge, Alert, Pagination, Form, Row, Col } from "react-bootstrap";
import CancelContractModal from "../components/CancelContractModal";
import EditContractModal from "../components/EditContractModal";
import { mediaUrl } from "../utils/mediaUrl";

const PAGE_SIZE = 20;

function propertyLabel(p) {
  const parts = [p.direction];
  if (p.floor) parts.push(`Piso ${p.floor}`);
  if (p.apartment) parts.push(`Depto ${p.apartment}`);
  return parts.join(" · ");
}

const AllContracts = () => {
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [contractToCancel, setContractToCancel] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contractToEdit, setContractToEdit] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const resolveContractId = (contract) =>
    contract.rental_contract_id || contract.id;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, startDateFilter, propertyId]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getContractHistory({
        page,
        pageSize: PAGE_SIZE,
        propertyId: propertyId || undefined,
        month: startDateFilter || undefined,
        tenant: debouncedSearch || undefined,
      });
      setContracts(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 0);
    } catch (err) {
      console.error("Error al obtener contratos", err);
      setError("No se pudieron cargar los contratos");
      setContracts([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (contract) => {
    try {
      setSelectedContract(contract);
      setShowModal(true);
      setLoadingPeriods(true);
      setError("");

      const rentalId = resolveContractId(contract);
      const data = await getPeriodsByContract(rentalId);

      if (!data || data.length === 0) {
        setError("No se encontraron períodos para este contrato");
        setPeriods([]);
      } else {
        setPeriods(data);
      }
    } catch (err) {
      console.error("Error al obtener períodos", err);
      setError("Error al cargar los períodos. Por favor intenta nuevamente.");
      setPeriods([]);
    } finally {
      setLoadingPeriods(false);
    }
  };

  useEffect(() => {
    getProperties()
      .then((list) => setProperties(list || []))
      .catch(() => setProperties([]));
  }, []);

  useEffect(() => {
    loadContracts();
  }, [page, debouncedSearch, startDateFilter, propertyId]);

  const settlementLabel = (direction) => {
    if (direction === "INQUILINO_A_PROPIETARIO") return "Inquilino → Propietario";
    if (direction === "PROPIETARIO_A_INQUILINO") return "Propietario → Inquilino";
    return "Sin monto";
  };

  const pageItems = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(pages, windowStart + 4);
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pageItems.push(p);
  }

  return (
    <div className="p-4">
      <h2>Historial de contratos</h2>
      <p className="text-muted small">
        Se listan todos, del más reciente al más viejo. El mes y la propiedad son filtros opcionales.
      </p>
      <Row className="g-3 mb-3">
        <Col md={4}>
          <Form.Control
            type="text"
            placeholder="Buscar por inquilino..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">Todas las propiedades</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {propertyLabel(p)}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Control
            type="month"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
          />
          <Form.Text className="text-muted">Mes de inicio (opcional)</Form.Text>
        </Col>
        {(propertyId || startDateFilter || searchTerm) && (
          <Col md={2} className="d-flex align-items-start">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setSearchTerm("");
                setPropertyId("");
                setStartDateFilter("");
              }}
            >
              Limpiar filtros
            </Button>
          </Col>
        )}
      </Row>
      {error && !showModal && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {loading ? (
        <p>Cargando contratos...</p>
      ) : (
        <>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>Dueño</th>
                <th>Inquilino</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Contrato</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    {contract.property?.direction ||
                      contract.property_address ||
                      "Sin dirección"}
                  </td>
                  <td>
                    {contract.owner_name ||
                      contract.property?.owner?.name ||
                      "Sin dueño"}
                  </td>
                  <td>{contract.tenant?.name || "Sin inquilino"}</td>
                  <td>{new Date(contract.start_date).toLocaleDateString()}</td>
                  <td>{new Date(contract.end_date).toLocaleDateString()}</td>
                  <td>
                    {contract.document_path ? (
                      <a
                        href={mediaUrl(contract.document_path)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver contrato
                      </a>
                    ) : (
                      <span className="text-muted">Sin archivo</span>
                    )}
                  </td>
                  <td>
                    {contract.cancelled ? (
                      <div>
                        <Badge bg="danger">
                          {new Date(contract.end_date) >= new Date(new Date().toDateString())
                            ? "Baja programada"
                            : "Baja"}
                        </Badge>
                        {contract.cancelled_by && (
                          <div>
                            <small>Por: {contract.cancelled_by}</small>
                          </div>
                        )}
                        <div>
                          <small>
                            Ocupación hasta:{" "}
                            {new Date(contract.end_date).toLocaleDateString()}
                          </small>
                        </div>
                        {contract.settlement_amount > 0 && (
                          <div>
                            <small>
                              ${Number(contract.settlement_amount).toLocaleString()}{" "}
                              ({settlementLabel(contract.settlement_direction)})
                            </small>
                          </div>
                        )}
                        {contract.receipt_path && (
                          <div>
                            <a
                              href={mediaUrl(contract.receipt_path)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver comprobante
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge bg="success">Activo / finalizado normal</Badge>
                    )}
                  </td>
                  <td className="d-flex flex-wrap gap-2">
                    <Button
                      variant="info"
                      size="sm"
                      onClick={() => handleViewDetails(contract)}
                    >
                      Ver Períodos
                    </Button>
                    {contract.rental_contract_id && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          setContractToEdit(contract);
                          setShowEditModal(true);
                        }}
                      >
                        {contract.document_path ? "Editar" : "Adjuntar contrato"}
                      </Button>
                    )}
                    {!contract.cancelled && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setContractToCancel(contract);
                          setShowCancelModal(true);
                        }}
                      >
                        Finalizar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!contracts.length && (
                <tr>
                  <td colSpan={8} className="text-center text-muted">
                    No hay contratos para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              {total} contrato{total === 1 ? "" : "s"}
            </small>
            {pages > 1 && (
              <Pagination className="mb-0">
                <Pagination.Prev
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
                {pageItems.map((p) => (
                  <Pagination.Item
                    key={p}
                    active={p === page}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                />
              </Pagination>
            )}
          </div>
        </>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Períodos —{" "}
            {selectedContract?.property?.direction ||
              selectedContract?.property_address}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedContract?.cancellation_reason && (
            <Alert variant="warning">
              <strong>Motivo de baja:</strong> {selectedContract.cancellation_reason}
              {selectedContract.cancelled_by && (
                <> (solicitado por {selectedContract.cancelled_by})</>
              )}
            </Alert>
          )}
          {loadingPeriods ? (
            <p>Cargando períodos...</p>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Fecha Inicio</th>
                  <th>Fecha Fin</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      {new Date(period.start_date).toLocaleDateString()}
                      {period.is_prorated && (
                        <div>
                          <Badge bg="info" text="dark">Proporcional</Badge>
                        </div>
                      )}
                    </td>
                    <td>{new Date(period.end_date).toLocaleDateString()}</td>
                    <td>
                      ${Number(period.period_rent || period.indexed_amount || 0).toLocaleString()}
                      {period.is_prorated && period.proration_note && (
                        <div>
                          <small className="text-muted">{period.proration_note}</small>
                        </div>
                      )}
                    </td>
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
                    </td>
                    <td>
                      <small>
                        {period.termination_note ||
                          period.payment_reference ||
                          "—"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      <CancelContractModal
        show={showCancelModal}
        onHide={() => {
          setShowCancelModal(false);
          setContractToCancel(null);
        }}
        contractId={
          contractToCancel ? resolveContractId(contractToCancel) : null
        }
        propertyLabel={
          contractToCancel?.property?.direction ||
          contractToCancel?.property_address
        }
        onCancelled={loadContracts}
      />
      <EditContractModal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false);
          setContractToEdit(null);
        }}
        contractId={
          contractToEdit ? resolveContractId(contractToEdit) : null
        }
        onSaved={loadContracts}
      />
    </div>
  );
};

export default AllContracts;
