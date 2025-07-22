import { useState } from "react"
import { createAgency } from "../api/real_agency"


export default function AgencyModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({ name: "", direction: "" })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    await createAgency(formData)
    onSave()
  }

return (
  <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header bg-light">
          <h5 className="modal-title fw-bold">Nueva Agencia</h5>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose}
            aria-label="Close"
          ></button>
        </div>
        
        <div className="modal-body p-4">
          <div className="mb-3">
            <label htmlFor="agencyName" className="form-label">Nombre de la Agencia</label>
            <input 
              id="agencyName"
              className="form-control form-control-lg" 
              name="name" 
              placeholder="Ej: Inmobiliaria Sol" 
              onChange={handleChange}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="agencyAddress" className="form-label">Dirección</label>
            <input 
              id="agencyAddress"
              className="form-control" 
              name="direction" 
              placeholder="Ej: Av. Siempreviva 742" 
              onChange={handleChange}
            />
          </div>
        </div>
        
        <div className="modal-footer border-top-0">
          <button 
            className="btn btn-outline-secondary px-4" 
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary px-4" 
            onClick={handleSubmit}
          >
            Registrar Agencia
          </button>
        </div>
      </div>
    </div>
  </div>
)
}