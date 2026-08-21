import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { createContract, parseContractDocument, uploadContractDocument } from "../api/contract";
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
  const [documentFile, setDocumentFile] = useState(null);
  const [parseWarning, setParseWarning] = useState("");
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (show) {
      setForm(emptyForm);
      setOwnerId("");
      setDocumentFile(null);
      setParseWarning("");
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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setDocumentFile(file);
    setParseWarning("");
  };

  const applySuggestions = (suggestions) => {
    if (!suggestions) return;
    setForm((prev) => {
      const next = { ...prev };
      const empty = (value) => value === "" || value === null || value === undefined;
      if (suggestions.start_date && empty(prev.start_date)) {
        next.start_date = suggestions.start_date;
      }
      if (suggestions.end_date && empty(prev.end_date)) {
        next.end_date = suggestions.end_date;
      }
      if (suggestions.base_rent && empty(prev.base_rent)) {
        next.base_rent = suggestions.base_rent;
      }
      if (suggestions.currency && prev.currency === emptyForm.currency) {
        next.currency = suggestions.currency;
      }
      if (suggestions.index_type && prev.index_type === emptyForm.index_type) {
        next.index_type = suggestions.index_type;
      }
      if (
        suggestions.frequency_adjustment &&
        prev.frequency_adjustment === emptyForm.frequency_adjustment
      ) {
        next.frequency_adjustment = suggestions.frequency_adjustment;
      }
      if (suggestions.pays_epe && !prev.pays_epe) next.pays_epe = true;
      if (suggestions.pays_tgi && !prev.pays_tgi) next.pays_tgi = true;
      if (suggestions.pays_api && !prev.pays_api) next.pays_api = true;
      if (suggestions.fire_insurance && !prev.fire_insurance) next.fire_insurance = true;
      return next;
    });
  };

  const handleParseDocument = async () => {
    if (!documentFile) {
      setParseWarning("Elegí un PDF para intentar leerlo.");
      return;
    }
    setParsing(true);
    setParseWarning("");
    try {
      const result = await parseContractDocument(documentFile);
      const warnings = result?.warnings || [];
      const suggestions = result?.suggestions || {};
      if (Object.keys(suggestions).length) {
        applySuggestions(suggestions);
      }
      if (warnings.length) {
        setParseWarning(warnings.join(" "));
      } else if (!Object.keys(suggestions).length) {
        setParseWarning("No se reconocieron campos. Completá el formulario a mano.");
      } else {
        setParseWarning("Se completaron solo los campos vacíos que se pudieron leer. Revisalos antes de guardar.");
      }
    } catch (err) {
      setParseWarning(err.message || "No se pudo leer el PDF. Podés cargarlo igual y completar a mano.");
    } finally {
      setParsing(false);
    }
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
      const created = await createContract(payload);
      if (documentFile && created?.id) {
        try {
          await uploadContractDocument(created.id, documentFile);
        } catch (uploadErr) {
          setError(
            uploadErr.message ||
              "Contrato creado, pero no se pudo subir el archivo. Podés adjuntarlo después desde Editar contrato."
          );
          onCreated();
          return;
        }
      }
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
                {form.start_date && Number(form.start_date.slice(8, 10)) > 1 && (
                  <Form.Text className="text-muted">
                    Como no entra el día 1, el primer mes se cobra proporcional (solo los días ocupados). Si paga ese monto, queda pagado — no es un pago parcial.
                  </Form.Text>
                )}
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
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="CUATRIMESTRAL">Cuatrimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
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

              <hr />
              <Form.Group className="mb-2">
                <Form.Label>Archivo del contrato (opcional)</Form.Label>
                <Form.Control
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                />
                <Form.Text className="text-muted d-block">
                  No es obligatorio. Para autocompletar tiene que ser un PDF con texto seleccionable (no una foto o escaneo). Después tocá “Intentar completar desde el PDF”. Solo rellena campos vacíos; lo que ya cargaste no se pisa.
                </Form.Text>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="mt-2"
                  type="button"
                  disabled={!documentFile || parsing}
                  onClick={handleParseDocument}
                >
                  {parsing ? "Leyendo..." : "Intentar completar desde el PDF"}
                </Button>
                {parseWarning && (
                  <Alert variant="info" className="mt-2 py-2 small mb-0">
                    {parseWarning}
                  </Alert>
                )}
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
