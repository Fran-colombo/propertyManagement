import { useEffect, useState } from "react";
import { getContractHistory } from "../api/contract";
import { getPeriodsByContract } from "../api/contract_period";
import { Table, Button, Modal, Badge, Alert } from "react-bootstrap";
import { getPropertyById } from "../api/property";
import { getTenantById } from "../api/person";
import CancelContractModal from "../components/CancelContractModal";
import { mediaUrl } from "../utils/mediaUrl";

const AllContracts = () => {
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [contractToCancel, setContractToCancel] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDateFilter, setStartDateFilter] = useState(() => {
    const current = new Date();
    return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  });

  const resolveContractId = (contract) =>
    contract.rental_contract_id || contract.id;

  const loadContracts = async () => {
    try {
      const contractsData = await getContractHistory();

      const contractsWithProps = await Promise.all(
        (contractsData || []).map(async (contract) => {
          let property = null;
          let tenant = null;
          try {
            if (contract.property_id) {
              property = await getPropertyById(contract.property_id);
            }
          } catch (_) {}
          try {
            if (contract.tenant_id) {
              tenant = await getTenantById(contract.tenant_id);
            }
          } catch (_) {}
          return {
            ...contract,
            property: property || { direction: contract.property_address },
            tenant,
          };
        })
      );

      setContracts(contractsWithProps);
    } catch (err) {
      console.error("Error al obtener contratos", err);
      setError("No se pudieron cargar los contratos");
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
    loadContracts();
  }, []);

  const settlementLabel = (direction) => {
    if (direction === "INQUILINO_A_PROPIETARIO") return "Inquilino → Propietario";
    if (direction === "PROPIETARIO_A_INQUILINO") return "Propietario → Inquilino";
    return "Sin monto";
  };

  return (
    <div className="p-4">
      <div className="d-flex gap-3 mb-3">
        <input
          type="text"
          placeholder="Buscar por inquilino..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-control"
        />
        <input
          type="month"
          value={startDateFilter}
          onChange={(e) => setStartDateFilter(e.target.value)}
          className="form-control"
        />
      </div>
      <h2>Historial de contratos</h2>
      {error && !showModal && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
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
          {contracts
            .filter((contract) => {
              const matchesTenant = contract.tenant?.name
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase());

              const matchesStartDate =
                !startDateFilter ||
                String(contract.start_date).startsWith(startDateFilter);

              return matchesTenant && matchesStartDate;
            })
            .map((contract) => (
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
                <td className="d-flex gap-2">
                  <Button
                    variant="info"
                    size="sm"
                    onClick={() => handleViewDetails(contract)}
                  >
                    Ver Períodos
                  </Button>
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
        </tbody>
      </Table>

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
    </div>
  );
};

export default AllContracts;
