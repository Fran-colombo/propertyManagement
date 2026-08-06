import { useState } from "react"
import { createOwner } from "../api/person"


export default function OwnerModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.email) {
      setError("Completá todos los campos")
      return
    }
    try {
      setSaving(true)
      setError("")
      await createOwner(formData)
      onSave()
    } catch (e) {
      console.error(e)
      setError(e.message || "Error al crear el propietario")
    } finally {
      setSaving(false)
    }
  }

return (
  <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header bg-light">
          <h5 className="modal-title fw-bold">Nuevo Propietario</h5>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose}
            aria-label="Close"
          ></button>
        </div>
        
        <div className="modal-body p-4">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="mb-3">
            <label htmlFor="nameInput" className="form-label">Nombre completo</label>
            <input 
              id="nameInput"
              className="form-control form-control-lg" 
              name="name" 
              placeholder="Ej: Juan Pérez" 
              onChange={handleChange}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="phoneInput" className="form-label">Teléfono</label>
            <input 
              id="phoneInput"
              className="form-control" 
              name="phone" 
              placeholder="Ej: 351-123-4567" 
              onChange={handleChange}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="emailInput" className="form-label">Email</label>
            <input 
              id="emailInput"
              className="form-control" 
              name="email" 
              type="email"
              placeholder="Ej: ejemplo@email.com" 
              onChange={handleChange}
            />
          </div>
        </div>
        
        <div className="modal-footer border-top-0">
          <button 
            className="btn btn-outline-secondary px-4" 
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary px-4" 
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Propietario"}
          </button>
        </div>
      </div>
    </div>
  </div>
)
}
