import { useEffect, useState } from "react";
import { getContractHistory, cancelContract } from "../api/contract";
import { getPeriodsByContract } from "../api/contract_period";
import { Table, Button, Modal, Badge } from "react-bootstrap";
import { getPropertyById } from "../api/property";
import { getTenantById } from "../api/person";

const AllContracts = () => {
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("");
  const [startDateFilter, setStartDateFilter] = useState(() => {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
});



const loadContracts = async () => {
  try {
    const contractsData = await getContractHistory();

    const contractsWithProps = await Promise.all(
      contractsData.map(async (contract) => {
        const property = await getPropertyById(contract.property_id);
        const tenant = await getTenantById(contract.tenant_id)
        return {
          ...contract,
          property,
          tenant,
        };
      })
    );

    setContracts(contractsWithProps);
  } catch (err) {
    console.error("Error al obtener contratos", err);
  }
};

const handleViewDetails = async (contract) => {
  try {
    setSelectedContract(contract);
    setShowModal(true);
    setLoadingPeriods(true);
    setError(null);
    
    const data = await getPeriodsByContract(contract.id);
    
    if (!data || data.length === 0) {
      setError(error, "No se encontraron períodos para este contrato");
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
      <h2>Todos los Contratos</h2>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Propiedad</th>
            <th>Inquilino</th>
            <th>Fecha Inicio</th>
            <th>Fecha Fin</th>
            <th>Acciones</th>
            <th>Finalizar contrato</th>
          </tr>
        </thead>
        <tbody>
          {contracts
            .filter(contract => {
              const matchesTenant = contract.tenant?.name
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase());

              const matchesStartDate = !startDateFilter ||
                contract.start_date.startsWith(startDateFilter); // YYYY-MM

              return matchesTenant && matchesStartDate;
            })
            .map(contract => (
            <tr key={contract.id}>
              <td>{contract.property?.direction || 'Sin dirección'}</td>
              <td>{contract.tenant?.name || 'Sin inquilino'}</td>
              <td>{new Date(contract.start_date).toLocaleDateString()}</td>
              <td>{new Date(contract.end_date).toLocaleDateString()}</td>
              <td>
                <Button 
                  variant="info" 
                  size="sm" 
                  onClick={() => handleViewDetails(contract)}
                >
                  Ver Períodos
                </Button>
              </td>
              <td> 
                <Button variant="danger" onClick={() => cancelContract(contract.id)}>
                  Cancelar Contrato
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Períodos de contrato - {selectedContract?.property?.direction}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
                </tr>
              </thead>
              <tbody>
                {periods.map(period => (
                  <tr key={period.id}>
                    <td>{new Date(period.start_date).toLocaleDateString()}</td>
                    <td>{new Date(period.end_date).toLocaleDateString()}</td>
                    <td>${period.indexed_amount.toLocaleString()}</td>
                    <td>
                      <Badge bg={
                          period.payment_status === 'PAGADO' ? 'success' : 
                          period.payment_status === 'CONTRATO_TERMINADO' ? 'danger' : 
                          'warning'
                        }>
                          {period.payment_status}
                        </Badge>
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
    </div>
  );
};

export default AllContracts;
