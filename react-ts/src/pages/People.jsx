import { useEffect, useState } from "react";
import { getOwners, getTenants, deleteOwner, deleteTenant, updateOwner, updateTenant } from "../api/person";
import { getAllAgencies, deleteAgency , updateAgency} from "../api/real_agency";
import { Plus, Search } from "lucide-react";
import OwnerModal from "../components/OwnerModal";
import TenantModal from "../components/TenantModal";
import AgencyModal from "../components/CreateAgenciesModal";
import UpdatePersonModal from "../components/UpdatePersonModal";

const PeopleAndAgencies = () => {
  const [activeTab, setActiveTab] = useState("owners");
  const [searchTerm, setSearchTerm] = useState("");
  const [owners, setOwners] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId]  = useState(null)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

   useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (activeTab === "owners") {
      const data = await getOwners();
      setOwners(data);
    } else if (activeTab === "tenants") {
      const data = await getTenants();
      setTenants(data);
    } else {
      const data = await getAllAgencies();
      setAgencies(data);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
  try {
    let response;
    if (activeTab === "owners") {
      response = await deleteOwner(id);
    } else if (activeTab === "tenants") {
      response = await deleteTenant(id);
    } else {
      response = await deleteAgency(id);
    }
    
    if (response.message) {
      // Recargar los datos después de eliminar
      fetchData();
      // Mostrar notificación de éxito
      alert(response.message);
    }
  } catch (error) {
    console.error("Error deleting:", error);
    alert(`Error al eliminar: ${error.message}`);
  }finally {
    setDeletingId(null);
  }
};

const confirmDelete = (item) => {
  const itemType = activeTab === "owners" ? "propietario" : 
                  activeTab === "tenants" ? "inquilino" : "agencia";
  
  if (window.confirm(`¿Estás seguro de eliminar al ${itemType} ${item.name}?`)) {
    handleDelete(item.id);
  }
};

  const handlePersonSaved = () => {
    setShowModal(false);
    fetchData();
  };

  const handleEdit = (item) => {
  setEditingItem({ ...item });
  setShowEditModal(true);
};

  const handleUpdate = async (data) => {
    try {
      if (activeTab === 'owners') {
        await updateOwner(data.id, {
          name: data.name,
          phone: data.phone,
          email: data.email
        });
      } else if (activeTab === 'tenants') {
        await updateTenant(data.id, {
          name: data.name,
          phone: data.phone,
          email: data.email
        });
      } else {
        await updateAgency(data.id, {
          name: data.name,
          direction: data.direction
        });
      }
      fetchData();
    } catch (error) {
      console.error("Update error:", error);
      throw error;
    }};

    
  const getFields = () => {
    switch (activeTab) {
      case 'owners':
      case 'tenants':
        return [
          { name: 'name', label: 'Nombre' },
          { name: 'phone', label: 'Teléfono' },
          { name: 'email', label: 'Email', type: 'email' }
        ];
      case 'agencies':
        return [
          { name: 'name', label: 'Nombre' },
          { name: 'direction', label: 'Dirección' }
        ];
      default:
        return [];
    }
  };
  const people =
    activeTab === "owners"
      ? owners
      : activeTab === "tenants"
      ? tenants
      : agencies;

  const filteredList = people.filter((item) => {
    return item.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

return (
  <div className="container mt-4">
    <div className="card">
      <div className="card-header bg-white border-bottom-0">
        <h1 className="h4 mb-0">Gestión de Personas</h1>
      </div>
      
      <div className="card-body">
        {/* Pestañas */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === "owners" ? "active" : ""}`}
              onClick={() => setActiveTab("owners")}
            >
              Propietarios
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === "tenants" ? "active" : ""}`}
              onClick={() => setActiveTab("tenants")}
            >
              Inquilinos
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === "agencies" ? "active" : ""}`}
              onClick={() => setActiveTab("agencies")}
            >
              Agencias
            </button>
          </li>
        </ul>

        {/* Barra de búsqueda y botón */}
        <div className="d-flex justify-content-between mb-4">
          <div className="input-group" style={{width: "300px"}}>
            <span className="input-group-text bg-white">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por nombre"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            className="btn btn-primary d-flex align-items-center"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} className="me-2" />
            Agregar {activeTab === "owners" ? "Propietario" : activeTab === "tenants" ? "Inquilino" : "Agencia"}
          </button>
        </div>

        {/* Lista de personas */}
        <div className="list-group">
          {filteredList.map((item) => (
            <div key={item.id} className="list-group-item p-4 border-0 shadow-sm mb-3 rounded">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="mb-2">{item.name}</h5>
                  {item.phone && (
                    <div className="d-flex align-items-center mb-1">
                      <span className="badge bg-light text-dark me-2">Teléfono</span>
                      <span>{item.phone}</span>
                    </div>
                  )}
                  {item.email && (
                    <div className="d-flex align-items-center">
                      <span className="badge bg-light text-dark me-2">Email</span>
                      <span>{item.email}</span>
                    </div>
                  )}
                </div>
                <div>
                <button 
                  className="btn btn-sm btn-outline-secondary me-2"
                  onClick={() => handleEdit(item)}
                >
                  Editar
                </button>
                  <button
                    disabled={deletingId === item.id}
                    onClick={() => confirmDelete(item)}
                  >
                    {deletingId === item.id ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      "Eliminar"
                    )}
                  </button>
                </div>
              </div>
              {item.direction && (
                <div className="mt-3">
                  <span className="badge bg-light text-dark me-2">Dirección</span>
                  <span>{item.direction}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Modales (se mantienen igual) */}
    {showModal && activeTab === "owners" && (
      <OwnerModal onClose={() => setShowModal(false)} onSave={handlePersonSaved} />
    )}
    {showModal && activeTab === "tenants" && (
      <TenantModal onClose={() => setShowModal(false)} onSave={handlePersonSaved} />
    )}
    {showModal && activeTab === "agencies" && (
      <AgencyModal onClose={() => setShowModal(false)} onSave={handlePersonSaved} />
    )}
      {showEditModal && editingItem && (
        <UpdatePersonModal
          item={editingItem}
          fields={getFields()}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleUpdate}
        />
      )}
  </div>
);
};

export default PeopleAndAgencies;
