import { useState } from 'react';

const UpdatePersonModal = ({ item, fields, onClose, onUpdate }) => {
  const [formData, setFormData] = useState(item);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onUpdate(formData);
      onClose();
    } catch (error) {
      alert(`Error al actualizar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Editar {item.name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              {fields.map(field => (
                <div key={field.name} className="mb-3">
                  <label className="form-label">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    className="form-control"
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    required
                  />
                </div>
              ))}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdatePersonModal;