import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Form,
  Modal,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  createAdminRow,
  deleteAdminRow,
  listAdminChoices,
  listAdminRows,
  listAdminTables,
  updateAdminRow,
} from "../api/admin";

function pkValue(tableMeta, row) {
  const key = tableMeta?.pk?.[0];
  return key ? row?.[key] : row?.id;
}

function emptyForm(columns) {
  const data = {};
  (columns || []).forEach((col) => {
    if (col.primary_key || col.hide_in_form) return;
    if (col.kind === "boolean") data[col.name] = false;
    else data[col.name] = "";
  });
  return data;
}

function rowToForm(columns, row) {
  const data = {};
  (columns || []).forEach((col) => {
    if (col.hide_in_form) return;
    const value = row?.[col.name];
    if (col.hidden) {
      data[col.name] = "";
      return;
    }
    if (col.kind === "boolean") data[col.name] = Boolean(value);
    else if (value == null) data[col.name] = "";
    else data[col.name] = value;
  });
  return data;
}

function formToPayload(columns, form, { creating }) {
  const payload = {};
  (columns || []).forEach((col) => {
    if (col.primary_key && !creating) return;
    if (col.hide_in_form) return;
    if (col.hidden && !form[col.name]) return;
    let value = form[col.name];
    if (col.kind === "boolean") {
      payload[col.name] = Boolean(value);
      return;
    }
    if (value === "" || value == null) {
      if (!creating && !col.primary_key) payload[col.name] = null;
      return;
    }
    if (col.kind === "integer" || col.fk) payload[col.name] = Number(value);
    else if (col.kind === "number") payload[col.name] = Number(value);
    else payload[col.name] = value;
  });
  return payload;
}

function cellText(column, row) {
  if (column.fk) return row[`${column.name}__label`] || "";
  const value = row[column.name];
  if (value === true) return "sí";
  if (value === false) return "no";
  if (value == null || value === "") return "";
  return String(value);
}

function FieldInput({ column, value, onChange, choices }) {
  if (column.fk) {
    const options = choices?.[column.name] || [];
    const selected = value === 0 || value ? String(value) : "";
    return (
      <Form.Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={String(opt.id)} value={String(opt.id)}>
            {opt.label || "Sin nombre"}
          </option>
        ))}
      </Form.Select>
    );
  }
  if (column.kind === "boolean") {
    return (
      <Form.Check
        type="switch"
        id={`admin-${column.name}`}
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        label={column.label || column.name}
      />
    );
  }
  if (column.options?.length) {
    return (
      <Form.Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {column.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </Form.Select>
    );
  }
  if (column.kind === "text") {
    return (
      <Form.Control
        as="textarea"
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const type =
    column.kind === "date"
      ? "date"
      : column.kind === "datetime"
        ? "datetime-local"
        : column.kind === "integer" || column.kind === "number"
          ? "number"
          : column.hidden
            ? "password"
            : "text";
  return (
    <Form.Control
      type={type}
      value={value ?? ""}
      step={column.kind === "number" ? "0.01" : undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={column.hidden ? "Dejar vacío para no cambiar" : ""}
    />
  );
}

export default function Sysadmin() {
  const [catalog, setCatalog] = useState({ shortcuts: [], tables: [] });
  const [tableName, setTableName] = useState("contract_periods");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const tableMeta = useMemo(
    () => (catalog.tables || []).find((t) => t.name === tableName) || null,
    [catalog, tableName]
  );
  const columns = tableMeta?.columns || [];
  const formColumns = columns.filter((c) => !c.hide_in_form);
  const visibleColumns = columns.filter((c) => !c.hidden && !c.hide_in_grid).slice(0, 7);
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const loadCatalog = useCallback(async () => {
    const data = await listAdminTables();
    setCatalog(data || { shortcuts: [], tables: [] });
  }, []);

  const loadRows = useCallback(async () => {
    if (!tableName) return;
    setLoading(true);
    setError("");
    try {
      const data = await listAdminRows(tableName, { q: search, page, pageSize });
      setRows(data?.rows || []);
      setTotal(data?.total || 0);
    } catch (err) {
      setError(err.message || "No se pudo cargar la tabla");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tableName, search, page]);

  useEffect(() => {
    loadCatalog().catch((err) => setError(err.message || "No se pudo cargar el catálogo"));
  }, [loadCatalog]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const openCreate = async () => {
    setError("");
    try {
      const choices = await listAdminChoices(tableName);
      setEditor({ mode: "create", form: emptyForm(columns), choices: choices || {} });
    } catch (err) {
      setError(err.message || "No se pudo abrir el editor");
    }
  };

  const openEdit = async (row) => {
    setError("");
    try {
      const choices = await listAdminChoices(tableName);
      setEditor({
        mode: "edit",
        id: pkValue(tableMeta, row),
        form: rowToForm(columns, row),
        choices: choices || {},
      });
    } catch (err) {
      setError(err.message || "No se pudo abrir el editor");
    }
  };

  const saveEditor = async () => {
    if (!editor || !tableName) return;
    setSaving(true);
    setError("");
    try {
      const payload = formToPayload(columns, editor.form, { creating: editor.mode === "create" });
      if (editor.mode === "create") await createAdminRow(tableName, payload);
      else await updateAdminRow(tableName, editor.id, payload);
      setEditor(null);
      await loadRows();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !tableName) return;
    setSaving(true);
    setError("");
    try {
      await deleteAdminRow(tableName, pkValue(tableMeta, pendingDelete));
      setPendingDelete(null);
      await loadRows();
    } catch (err) {
      setError(err.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="h4">Sysadmin</h2>
      <p className="text-muted">
        Editor de tablas. Los atajos de contratos y períodos sirven para corregir bajas, TGI y montos a mano.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {(catalog.shortcuts || []).map((table) => (
          <Button
            key={table.name}
            variant={tableName === table.name ? "primary" : "outline-primary"}
            onClick={() => {
              setTableName(table.name);
              setPage(1);
              setSearch("");
              setQ("");
            }}
          >
            {table.label}
          </Button>
        ))}
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <Form.Group className="mb-0" style={{ minWidth: 220 }}>
          <Form.Label className="small mb-1">Tabla</Form.Label>
          <Form.Select
            value={tableName}
            onChange={(e) => {
              setTableName(e.target.value);
              setPage(1);
              setSearch("");
              setQ("");
            }}
          >
            {(catalog.tables || []).map((table) => (
              <option key={table.name} value={table.name}>
                {table.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form
          className="d-flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <Form.Control
            placeholder="Buscar por nombre"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit" variant="outline-secondary">
            Buscar
          </Button>
        </Form>
        <Button variant="success" onClick={openCreate} disabled={!tableMeta}>
          Nueva fila
        </Button>
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover size="sm" className="small">
            <thead>
              <tr>
                <th>Nombre</th>
                {visibleColumns.map((col) => (
                  <th key={col.name}>{col.label || col.name}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = pkValue(tableMeta, row);
                return (
                  <tr key={String(id)}>
                    <td className="text-break">{row._label || ""}</td>
                    {visibleColumns.map((col) => (
                      <td key={col.name} className="text-break">
                        {cellText(col, row)}
                      </td>
                    ))}
                    <td className="text-nowrap">
                      <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => openEdit(row)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => setPendingDelete(row)}>
                        Borrar
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="text-center text-muted">
                    No hay filas.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}

      <div className="d-flex align-items-center gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </Button>
        <span className="small text-muted">
          Página {page} de {pages} · {total} filas
        </span>
        <Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          Siguiente
        </Button>
      </div>

      <Modal show={!!editor} onHide={() => setEditor(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editor?.mode === "create" ? "Nueva fila" : "Editar fila"} · {tableMeta?.label}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editor &&
            formColumns.map((col) => (
              <Form.Group className="mb-2" key={col.name}>
                {col.kind === "boolean" && !col.fk ? (
                  <FieldInput
                    column={col}
                    value={editor.form[col.name]}
                    choices={editor.choices}
                    onChange={(value) =>
                      setEditor((prev) => ({
                        ...prev,
                        form: { ...prev.form, [col.name]: value },
                      }))
                    }
                  />
                ) : (
                  <>
                    <Form.Label className="small mb-1">
                      {col.label || col.name}
                      {col.nullable ? "" : " *"}
                    </Form.Label>
                    <FieldInput
                      column={col}
                      value={editor.form[col.name]}
                      choices={editor.choices}
                      onChange={(value) =>
                        setEditor((prev) => ({
                          ...prev,
                          form: { ...prev.form, [col.name]: value },
                        }))
                      }
                    />
                  </>
                )}
              </Form.Group>
            ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditor(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={saveEditor} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!pendingDelete} onHide={() => setPendingDelete(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Borrar fila</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          ¿Eliminar {pendingDelete?._label || tableMeta?.label}? Esta acción no se puede deshacer.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={saving}>
            {saving ? "Borrando..." : "Borrar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
