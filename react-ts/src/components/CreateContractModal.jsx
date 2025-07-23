import { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { createContract } from "../api/contract";
import { getProperties } from "../api/property";
import { getTenants } from "../api/person";
import { getGarages } from "../api/garage";
import { getAllAgencies } from "../api/real_agency";


export default function CreateContractModal({ show, onHide, onCreated }) {
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    tenant_id: "",
    property_id: "",
    garage_id: null,
    base_rent: "",
    real_agency_id: null,
    currency: "PESOS",
    index_type: "IPC",
    frequency_adjustment: "TRIMESTRAL",
    includes_garage: false,
    fire_insurance: false,
    pays_api: false,
    pays_tgi: false,
    pays_epe: false,
    notes: ""
  });

  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [garages, setGarages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [realAgencies, setRealAgencies] = useState([]);


  useEffect(() => {
    if (show) {
      loadData();
    }
  }, [show]);

const loadData = async () => {
  setLoading(true);
  setError("");
  try {
    const [p, t, g, a] = await Promise.all([
      getProperties(),
      getTenants(),
      getGarages(),
      getAllAgencies(),
    ]);
    setProperties(p || []);
    setTenants(t || []);
    setGarages(g || []);
    setRealAgencies(a || [])
  } catch (e) {
    console.error("Error loading data:", e);
    setError("Error al cargar los datos. Por favor intenta nuevamente.");
  } finally {
    setLoading(false);
  }
};


const handleChange = (e) => {
  const { name, value, type, checked } = e.target;

  let newValue = value;
  if (type === "checkbox") {
    newValue = checked;
  } else if ((name === "real_agency_id" || name === "garage_id") && value === "") {
    newValue = null;
  } else if (name === "real_agency_id" || name === "garage_id") {
    newValue = parseInt(value, 10);
  }

  setForm((prev) => ({
    ...prev,
    [name]: newValue,
  }));
};

  const isValid = () => {
    return (
      form.start_date &&
      form.end_date &&
      new Date(form.end_date) > new Date(form.start_date) &&
      form.tenant_id &&
      form.property_id &&
      form.currency &&
      form.base_rent &&
      form.index_type &&
      form.frequency_adjustment
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid()) {
      setError("Revisá los campos obligatorios.");
      return;
    }
    setError("");
    await createContract(form);
    onCreated();
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Nuevo Contrato</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
             {error && (
                <div className="alert alert-danger">
                  {typeof error === 'string' ? error : 'Ocurrió un error inesperado'}
                </div>
              )}

          <Form.Group className="mb-2">
            <Form.Label>Propiedad</Form.Label>
            <Form.Select name="property_id" value={form.property_id} onChange={handleChange}>
              <option value="">Seleccione propiedad</option>
              {properties
                .filter((p) => p.rental_contract === null) 
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.direction} - {p.apartment} - {p.floor} - {p.owner.name}
                  </option>
                ))}
            </Form.Select>
          </Form.Group>


              <Form.Group className="mb-2">
                <Form.Label>Inquilino</Form.Label>
                <Form.Select name="tenant_id" value={form.tenant_id} onChange={handleChange}>
                  <option value="">Seleccione inquilino</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {t.phone}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-2">
              <Form.Label>Agencia inmobiliaria</Form.Label>
              <Form.Select name="real_agency_id" value={form.real_agency_id} onChange={handleChange}>
                <option value="">Seleccione agencia</option>
                {realAgencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>


              <Form.Group className="mb-2">
                <Form.Label>Fecha inicio</Form.Label>
                <Form.Control type="date" name="start_date" value={form.start_date} onChange={handleChange} />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Fecha fin</Form.Label>
                <Form.Control type="date" name="end_date" value={form.end_date} onChange={handleChange} />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Moneda</Form.Label>
                <Form.Select name="currency" value={form.currency} onChange={handleChange}>
                  <option value="PESOS">PESOS</option>
                  <option value="DOLARES">USD</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Monto base</Form.Label>
                <Form.Control type="number" name="base_rent" value={form.base_rent} onChange={handleChange} onWheel={(e) => e.target.blur()}/>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Índice</Form.Label>
                <Form.Select name="index_type" value={form.index_type} onChange={handleChange}>
                  <option value="IPC">IPC</option>
                  <option value="ICL">ICL</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Frecuencia de ajuste</Form.Label>
                <Form.Select name="frequency_adjustment" value={form.frequency_adjustment} onChange={handleChange}>
                  <option value="TRIMESTRAL">TRIMESTRAL</option>
                  <option value="CUATRIMESTRAL">CUATRIMESTRAL</option>
                </Form.Select>
              </Form.Group>

              <Form.Check
                type="checkbox"
                label="Incluye cochera"
                name="includes_garage"
                checked={form.includes_garage}
                onChange={handleChange}
              />

              {form.includes_garage && (
                <Form.Group className="mb-2">
                  <Form.Label>Cochera</Form.Label>
                  <Form.Select name="garage_id" value={form.garage_id} onChange={handleChange}>
                    <option value="">Seleccione cochera</option>
                    {garages.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.number}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}

              <hr />
              <Form.Check label="Seguro contra incendio" name="fire_insurance" checked={form.fire_insurance} onChange={handleChange} />
              <Form.Check label="Paga API" name="pays_api" checked={form.pays_api} onChange={handleChange} />
              <Form.Check label="Paga TGI" name="pays_tgi" checked={form.pays_tgi} onChange={handleChange} />
              <Form.Check label="Paga EPE" name="pays_epe" checked={form.pays_epe} onChange={handleChange} />

              <Form.Group className="mt-2">
                <Form.Label>Notas</Form.Label>
                <Form.Control as="textarea" rows={3} name="notes" value={form.notes} onChange={handleChange} />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={!isValid()}>Guardar</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
