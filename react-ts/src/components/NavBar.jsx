import { useEffect, useState } from "react";
import { Navbar, Nav, NavDropdown, Container, Offcanvas, Badge } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import {
  House,
  People,
  Building,
  CashStack,
  FileEarmarkText,
  GraphUp,
  Download,
  ReceiptCutoff,
  Gear,
} from "react-bootstrap-icons";
import { getSalesSummary } from "../api/sale";

const linkClass = (active) =>
  `nav-compact-link d-flex align-items-center ${
    active ? "bg-primary text-white" : "text-dark"
  }`;

export default function NavigationBar() {
  const location = useLocation();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingInstallments, setPendingInstallments] = useState(0);

  useEffect(() => {
    getSalesSummary()
      .then((data) => setPendingInstallments(data?.pending_installments || 0))
      .catch(() => setPendingInstallments(0));
  }, [location.pathname]);

  const closeMenu = () => setMenuOpen(false);
  const path = location.pathname;
  const contractsOpen = path === "/contracts" || path === "/all-contracts";
  const cajaOpen =
    path === "/transactions" || path === "/ingresos" || path === "/exportar";

  const links = (onSelect, { inOffcanvas = false } = {}) => (
    <>
      <Nav.Link
        as={Link}
        to="/people"
        active={path === "/people"}
        onClick={onSelect}
        className={linkClass(path === "/people")}
      >
        <People className="me-1" size={15} />
        Personas
      </Nav.Link>
      <Nav.Link
        as={Link}
        to="/properties"
        active={path === "/properties"}
        onClick={onSelect}
        className={linkClass(path === "/properties")}
      >
        <Building className="me-1" size={15} />
        Propiedades
      </Nav.Link>
      <Nav.Link
        as={Link}
        to="/sales"
        active={path === "/sales"}
        onClick={onSelect}
        className={linkClass(path === "/sales")}
      >
        <CashStack className="me-1" size={15} />
        Ventas
        {pendingInstallments > 0 && (
          <Badge
            bg={path === "/sales" ? "light" : "warning"}
            text="dark"
            className="ms-1"
            title="Cuotas de venta por cobrar"
          >
            {pendingInstallments}
          </Badge>
        )}
      </Nav.Link>
      <NavDropdown
        title={
          <span className="d-inline-flex align-items-center">
            <FileEarmarkText className="me-1" size={15} />
            Contratos
          </span>
        }
        id={inOffcanvas ? "nav-contratos-mobile" : "nav-contratos"}
        active={contractsOpen}
        className={`nav-compact-dropdown ${contractsOpen ? "nav-compact-active" : ""}`}
      >
        <NavDropdown.Item as={Link} to="/contracts" onClick={onSelect} active={path === "/contracts"}>
          Activos
        </NavDropdown.Item>
        <NavDropdown.Item
          as={Link}
          to="/all-contracts"
          onClick={onSelect}
          active={path === "/all-contracts"}
        >
          Historial
        </NavDropdown.Item>
      </NavDropdown>
      <NavDropdown
        title={
          <span className="d-inline-flex align-items-center">
            <ReceiptCutoff className="me-1" size={15} />
            Caja
          </span>
        }
        id={inOffcanvas ? "nav-caja-mobile" : "nav-caja"}
        active={cajaOpen}
        className={`nav-compact-dropdown ${cajaOpen ? "nav-compact-active" : ""}`}
      >
        <NavDropdown.Item
          as={Link}
          to="/transactions"
          onClick={onSelect}
          active={path === "/transactions"}
        >
          Transacciones
        </NavDropdown.Item>
        <NavDropdown.Item as={Link} to="/ingresos" onClick={onSelect} active={path === "/ingresos"}>
          <GraphUp className="me-1" size={14} />
          Ingresos
        </NavDropdown.Item>
        <NavDropdown.Item as={Link} to="/exportar" onClick={onSelect} active={path === "/exportar"}>
          <Download className="me-1" size={14} />
          Exportar
        </NavDropdown.Item>
      </NavDropdown>
      <Nav.Link
        as={Link}
        to="/configuracion"
        active={path === "/configuracion"}
        onClick={onSelect}
        className={linkClass(path === "/configuracion")}
        title="Configuración"
        aria-label="Configuración"
      >
        <Gear size={16} />
        {inOffcanvas && <span className="ms-1">Configuración</span>}
      </Nav.Link>
      <Nav.Link
        as="button"
        onClick={() => {
          onSelect?.();
          logout();
        }}
        className="nav-compact-link d-flex align-items-center text-danger border-0 bg-transparent"
      >
        Salir
      </Nav.Link>
    </>
  );

  return (
    <Navbar bg="light" expand="xl" className="shadow-sm border-bottom py-1" sticky="top">
      <Container fluid="xl">
        <Navbar.Brand as={Link} to="/" className="fw-bold text-primary d-flex align-items-center py-1">
          <House className="me-2" size={20} />
          <span>Gestión Inmobiliaria</span>
        </Navbar.Brand>
        <Navbar.Toggle
          aria-controls="main-navbar"
          onClick={() => setMenuOpen(true)}
        />
        <Nav className="ms-auto d-none d-xl-flex align-items-center flex-nowrap">
          {links()}
        </Nav>
        <Offcanvas
          id="main-navbar"
          placement="end"
          show={menuOpen}
          onHide={closeMenu}
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Menú</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Nav className="flex-column">{links(closeMenu, { inOffcanvas: true })}</Nav>
          </Offcanvas.Body>
        </Offcanvas>
      </Container>
    </Navbar>
  );
}
