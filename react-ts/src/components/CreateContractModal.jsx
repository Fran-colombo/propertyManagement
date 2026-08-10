import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { createContract } from "../api/contract";
import { getProperties } from "../api/property";
import { getOwners, getTenants } from "../api/person";
import { getGarages } from "../api/garage";
import { getAllAgencies } from "../api/real_agency";

const emptyForm = {
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
  garage_only: false,
  fire_insurance: false,
  pays_api: false,
  pays_tgi: false,
  pays_epe: false,
  notes: "",
};

function propertyLabel(p) {
  const parts = [p.direction];
  if (p.floor) parts.push(`Piso ${p.floor}`);
  if (p.apartment) parts.push(`Depto ${p.apartment}`);
  return parts.join(" · ");
}

function garageLabel(g) {
  let label = `Garage N° ${g.number}`;
  if (g.owner_name) label += ` — ${g.owner_name}`;
  if (g.property_direction) label += ` (asoc. ${g.property_direction})`;
  else label += " (sin propiedad)";
  return label;
}

export default function CreateContractModal({ show, onHide, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [ownerId, setOwnerId] = useState("");
  const [properties, setProperties] = useState([]);
  const [owners, setOwners] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [garages, setGarages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [realAgencies, setRealAgencies] = useState([]);

  useEffect(() => {
    if (show) {
      setForm(emptyForm);
      setOwnerId("");
      loadData();
    }
  }, [show]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        getProperties(),
        getTenants(),
        getGarages(),
        getAllAgencies(),
        getOwners(),
      ]);

      const [p, t, g, a, o] = results.map((r) =>
        r.status === "fulfilled" ? r.value || [] : []
      );

      setProperties(p);
      setTenants(t);
      setGarages(g);
      setRealAgencies(a);
      setOwners(o);

      if (results.every((r) => r.status === "rejected")) {
        setError("Error al cargar los datos. Por favor intenta nuevamente.");
      }
    } catch (e) {
      console.error("Error loading data:", e);
      setError("Error al cargar los datos. Por favor intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const availableProperties = useMemo(() => {
    return properties.filter((p) => {
      if (p.rental_contract) return false;
      if (ownerId && p.owner?.id !== parseInt(ownerId, 10)) return false;
      return true;
    });
  }, [properties, ownerId]);

  const availableGarages = useMemo(() => {
    return garages.filter((g) => {
      if (g.rental_contract_id) return false;
      if (ownerId && g.owner_id !== parseInt(ownerId, 10)) return false;
      return true;
    });
  }, [garages, ownerId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    let newValue = value;
    if (type === "checkbox") {
      newValue = checked;
    } else if ((name === "real_agency_id" || name === "garage_id") && value === "") {
      newValue = null;
    } else if (name === "real_agency_id" || name === "garage_id" || name === "property_id" || name === "tenant_id") {
      newValue = value === "" ? "" : parseInt(value, 10);
    }

    setForm((prev) => {
      const next = { ...prev, [name]: newValue };
      if (name === "garage_only" && checked) {
        next.property_id = "";
        next.includes_garage = true;
      }
      if (name === "garage_only" && !checked) {
        next.garage_id = null;
      }
      return next;
    });
  };

  const handleOwnerChange = (e) => {
    const value = e.target.value;
    setOwnerId(value);
    setForm((prev) => ({
      ...prev,
      property_id: "",
      garage_id: null,
    }));
  };

  const isValid = () => {
    const hasTarget = form.garage_only
      ? !!form.garage_id
      : !!form.property_id;
    return (
      form.start_date &&
      form.end_date &&
      new Date(form.end_date) > new Date(form.start_date) &&
      form.tenant_id &&
      hasTarget &&
      form.currency &&
      form.base_rent &&
      (form.currency === "DOLARES" || (form.index_type && form.frequency_adjustment))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid()) {
      setError("Revisá los campos obligatorios.");
      return;
    }
    setError("");
    try {
      const payload = {
        ...form,
        property_id: form.garage_only ? null : form.property_id || null,
        garage_id: form.garage_id || null,
        includes_garage: form.garage_only || form.includes_garage,
        real_agency_id: form.real_agency_id || null,
        index_type: form.currency === "DOLARES" ? null : form.index_type,
        frequency_adjustment:
          form.currency === "DOLARES" ? null : form.frequency_adjustment,
      };
      delete payload.garage_only;
      await createContract(payload);
      onCreated();
      onHide();
    } catch (err) {
      setError(err.message || "Error al crear el contrato");
    }
  };

  return (
    <Modal show={show} onHide={onHide} backdrop="static" size="lg">
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
                <Alert variant="danger">
                  {typeof error === "string" ? error : "Ocurrió un error inesperado"}
                </Alert>
              )}

              <Form.Group className="mb-2">
                <Form.Label>Dueño</Form.Label>
                <Form.Select value={ownerId} onChange={handleOwnerChange}>
                  <option value="">Todos los dueños</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.email ? `— ${o.email}` : ""}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Filtra propiedades y garages de ese dueño.
                </Form.Text>
              </Form.Group>

              <Form.Check
                className="mb-3"
                type="checkbox"
                label="Contrato solo de garage (alquiler separado)"
                name="garage_only"
                checked={form.garage_only}
                onChange={handleChange}
              />

              {!form.garage_only && (
                <Form.Group className="mb-2">
                  <Form.Label>Propiedad *</Form.Label>
                  <Form.Select
                    name="property_id"
                    value={form.property_id}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione propiedad</option>
                    {availableProperties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {propertyLabel(p)} — {p.owner?.name || "Sin dueño"}
                      </option>
                    ))}
                  </Form.Select>
                  {availableProperties.length === 0 && (
                    <Form.Text className="text-danger">
                      No hay propiedades disponibles para este filtro.
                    </Form.Text>
                  )}
                </Form.Group>
              )}

              <Form.Group className="mb-2">
                <Form.Label>Inquilino *</Form.Label>
                <Form.Select
                  name="tenant_id"
                  value={form.tenant_id}
                  onChange={handleChange}
                >
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
                <Form.Select
                  name="real_agency_id"
                  value={form.real_agency_id ?? ""}
                  onChange={handleChange}
                >
                  <option value="">Seleccione agencia</option>
                  {realAgencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Fecha inicio *</Form.Label>
                <Form.Control
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Fecha fin *</Form.Label>
                <Form.Control
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Moneda</Form.Label>
                <Form.Select
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                >
                  <option value="PESOS">PESOS</option>
                  <option value="DOLARES">USD</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Monto base *</Form.Label>
                <Form.Control
                  type="number"
                  name="base_rent"
                  value={form.base_rent}
                  onChange={handleChange}
                  onWheel={(e) => e.target.blur()}
                />
              </Form.Group>

              {form.currency !== "DOLARES" && (
                <>
                  <Form.Group className="mb-2">
                    <Form.Label>Índice</Form.Label>
                    <Form.Select
                      name="index_type"
                      value={form.index_type}
                      onChange={handleChange}
                    >
                      <option value="IPC">IPC</option>
                      <option value="ICL">ICL</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>Frecuencia de ajuste</Form.Label>
                    <Form.Select
                      name="frequency_adjustment"
                      value={form.frequency_adjustment}
                      onChange={handleChange}
                    >
                      <option value="TRIMESTRAL">TRIMESTRAL</option>
                      <option value="CUATRIMESTRAL">CUATRIMESTRAL</option>
                    </Form.Select>
                  </Form.Group>
                </>
              )}

              {!form.garage_only && (
                <Form.Check
                  type="checkbox"
                  label="Incluye cochera en este contrato"
                  name="includes_garage"
                  checked={form.includes_garage}
                  onChange={handleChange}
                />
              )}

              {(form.garage_only || form.includes_garage) && (
                <Form.Group className="mb-2 mt-2">
                  <Form.Label>Garage *</Form.Label>
                  <Form.Select
                    name="garage_id"
                    value={form.garage_id ?? ""}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione garage</option>
                    {availableGarages.map((g) => (
                      <option key={g.id} value={g.id}>
                        {garageLabel(g)}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Un garage puede estar asociado a una propiedad y aún así alquilarse por separado.
                  </Form.Text>
                </Form.Group>
              )}

              <hr />
              <Form.Check
                label="Seguro contra incendio"
                name="fire_insurance"
                checked={form.fire_insurance}
                onChange={handleChange}
              />
              <Form.Check
                label="Paga API"
                name="pays_api"
                checked={form.pays_api}
                onChange={handleChange}
              />
              <Form.Check
                label="Paga TGI"
                name="pays_tgi"
                checked={form.pays_tgi}
                onChange={handleChange}
              />
              <Form.Check
                label="Paga EPE"
                name="pays_epe"
                checked={form.pays_epe}
                onChange={handleChange}
              />

              <Form.Group className="mt-2">
                <Form.Label>Notas</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!isValid() || loading}>
            Guardar
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
