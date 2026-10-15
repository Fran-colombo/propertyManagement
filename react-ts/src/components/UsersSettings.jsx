import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { createUser, getUsers, updateUser } from "../api/users";

const ROLE_LABELS = {
  user: "Operador",
  admin: "Administrador",
};

const emptyForm = {
  name: "",
  surname: "",
  email: "",
  password: "",
  role: "user",
};

export default function UsersSettings({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setUsers((await getUsers()) || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (action, message) => {
    try {
      setSaving(true);
      setError("");
      setOk("");
      await action();
      setOk(message);
      await load();
      return true;
    } catch (err) {
      setError(err.message || "No se pudo guardar.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    const done = await run(
      () => createUser({ ...form, email: form.email.trim() }),
      `Usuario creado. Ya puede entrar con ${form.email.trim()} y la contraseña que pusiste.`
    );
    if (done) setForm(emptyForm);
  };

  const onResetPassword = async (user) => {
    if (newPassword.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    const done = await run(
      () => updateUser(user.id, { password: newPassword }),
      `Contraseña de ${user.name} actualizada.`
    );
    if (done) {
      setResetFor(null);
      setNewPassword("");
    }
  };

  return (
    <Card className="shadow-sm mt-4" style={{ maxWidth: 900 }}>
      <Card.Body>
        <Card.Title>Usuarios</Card.Title>
        <Card.Text className="text-muted small">
          Un operador puede gestionar alquileres, cobros, contratos, personas y
          propiedades. Solo un administrador puede crear o desactivar usuarios.
        </Card.Text>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {ok && (
          <Alert variant="success" dismissible onClose={() => setOk("")}>
            {ok}
          </Alert>
        )}

        {loading ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <Table responsive size="sm" className="align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isMe = user.id === currentUserId;
                const active = user.status === 1;
                return (
                  <tr key={user.id} className={active ? "" : "text-muted"}>
                    <td>
                      {user.name} {user.surname}
                      {isMe && <span className="small text-muted"> (vos)</span>}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={user.role}
                        disabled={saving || isMe || !active}
                        onChange={(e) =>
                          run(
                            () => updateUser(user.id, { role: e.target.value }),
                            `${user.name} ahora es ${ROLE_LABELS[e.target.value].toLowerCase()}.`
                          )
                        }
                        style={{ maxWidth: 160 }}
                      >
                        <option value="user">{ROLE_LABELS.user}</option>
                        <option value="admin">{ROLE_LABELS.admin}</option>
                      </Form.Select>
                    </td>
                    <td>
                      <Badge bg={active ? "success" : "secondary"}>
                        {active ? "Activo" : "Desactivado"}
                      </Badge>
                    </td>
                    <td>
                      {resetFor === user.id ? (
                        <div className="d-flex gap-1">
                          <Form.Control
                            size="sm"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Nueva contraseña"
                            autoComplete="new-password"
                            style={{ maxWidth: 160 }}
                          />
                          <Button size="sm" disabled={saving} onClick={() => onResetPassword(user)}>
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            disabled={saving}
                            onClick={() => {
                              setResetFor(null);
                              setNewPassword("");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="d-flex flex-wrap gap-1">
                          {active && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={saving}
                              onClick={() => {
                                setResetFor(user.id);
                                setNewPassword("");
                              }}
                            >
                              Cambiar contraseña
                            </Button>
                          )}
                          {!isMe && (
                            <Button
                              size="sm"
                              variant={active ? "outline-danger" : "outline-success"}
                              disabled={saving}
                              onClick={() => {
                                if (
                                  active &&
                                  !window.confirm(`¿Desactivar a ${user.name}? No va a poder entrar más.`)
                                ) {
                                  return;
                                }
                                run(
                                  () => updateUser(user.id, { status: active ? 0 : 1 }),
                                  active
                                    ? `${user.name} quedó desactivado.`
                                    : `${user.name} se reactivó.`
                                );
                              }}
                            >
                              {active ? "Desactivar" : "Reactivar"}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <h3 className="h6 mt-3">Nuevo usuario</h3>
        <Form onSubmit={onCreate} autoComplete="off">
          <Row className="g-2">
            <Col md={6}>
              <Form.Control
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="Nombre"
                required
              />
            </Col>
            <Col md={6}>
              <Form.Control
                name="surname"
                value={form.surname}
                onChange={onChange}
                placeholder="Apellido"
                required
              />
            </Col>
            <Col md={6}>
              <Form.Control
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                placeholder="Email (con esto inicia sesión)"
                autoComplete="off"
                required
              />
            </Col>
            <Col md={6}>
              <Form.Control
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                placeholder="Contraseña (mínimo 8 caracteres)"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Col>
            <Col md={6}>
              <Form.Select name="role" value={form.role} onChange={onChange}>
                <option value="user">Operador: gestiona alquileres y cobros</option>
                <option value="admin">Administrador: además gestiona usuarios</option>
              </Form.Select>
            </Col>
            <Col md={6}>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Crear usuario"}
              </Button>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}
