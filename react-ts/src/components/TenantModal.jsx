import { useState } from "react"
import { createTenant } from "../api/person"


export default function TenantModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    await createTenant(formData)
    onSave()
  }

return (
  <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header bg-light">
          <h5 className="modal-title fw-bold">Nuevo Inquilino</h5>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose}
            aria-label="Close"
          ></button>
        </div>
        
        <div className="modal-body p-4">
          <div className="mb-3">
            <label htmlFor="tenantName" className="form-label">Nombre completo</label>
            <input 
              id="tenantName"
              className="form-control form-control-lg" 
              name="name" 
              placeholder="Ej: María González" 
              onChange={handleChange}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="tenantPhone" className="form-label">Teléfono</label>
            <input 
              id="tenantPhone"
              className="form-control" 
              name="phone" 
              placeholder="Ej: 351-765-4321" 
              onChange={handleChange}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="tenantEmail" className="form-label">Email</label>
            <input 
              id="tenantEmail"
              className="form-control" 
              name="email" 
              type="email"
              placeholder="Ej: inquilino@email.com" 
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
            Guardar Inquilino
          </button>
        </div>
      </div>
    </div>
  </div>
)
}
