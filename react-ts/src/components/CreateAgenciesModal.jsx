import { useState } from "react"
import { createAgency } from "../api/real_agency"
import FeedbackModal from "./FeedbackModal"

export default function AgencyModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({ name: "", direction: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState(null)
  const [formVisible, setFormVisible] = useState(true)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.direction) {
      setError("Completá todos los campos")
      return
    }
    try {
      setSaving(true)
      setError("")
      await createAgency(formData)
      setFormVisible(false)
      setFeedback({
        variant: "success",
        title: "Agencia creada",
        message: "La agencia se registró correctamente.",
      })
    } catch (e) {
      setFormVisible(false)
      setFeedback({
        variant: "danger",
        title: "Error",
        message: e.message || "Error al crear la agencia",
      })
    } finally {
      setSaving(false)
    }
  }

  const closeFeedback = () => {
    const variant = feedback?.variant
    setFeedback(null)
    if (variant === "danger") {
      setFormVisible(true)
    } else {
      onSave()
      onClose()
    }
  }

  return (
    <>
    {formVisible && (
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
          {error && <div className="alert alert-danger">{error}</div>}
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
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary px-4" 
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Registrar Agencia"}
          </button>
        </div>
      </div>
    </div>
  </div>
    )}
    <FeedbackModal
      show={!!feedback}
      variant={feedback?.variant}
      title={feedback?.title}
      message={feedback?.message}
      onClose={closeFeedback}
    />
    </>
  )
}
