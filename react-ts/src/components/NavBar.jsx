import { useEffect, useState } from "react";
import { Navbar, Nav, Container, Offcanvas, Badge } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import {
  House,
  People,
  Building,
  CashStack,
  FileEarmarkText,
} from "react-bootstrap-icons";
import { getSalesSummary } from "../api/sale";

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

  const navItems = [
    { to: "/people", icon: <People className="me-2" />, label: "Personas" },
    { to: "/properties", icon: <Building className="me-2" />, label: "Propiedades" },
    {
      to: "/sales",
      icon: <CashStack className="me-2" />,
      label: "Ventas",
      badge: pendingInstallments,
    },
    { to: "/transactions", icon: <CashStack className="me-2" />, label: "Transacciones" },
    { to: "/contracts", icon: <FileEarmarkText className="me-2" />, label: "Contratos activos" },
    { to: "/all-contracts", icon: <FileEarmarkText className="me-2" />, label: "Historial de contratos" },
  ];

  const closeMenu = () => setMenuOpen(false);

  const links = (onSelect) => (
    <>
      {navItems.map(({ to, icon, label, badge }) => (
        <Nav.Link
          as={Link}
          to={to}
          key={to}
          active={location.pathname === to}
          onClick={onSelect}
          className={`d-flex align-items-center px-3 py-2 rounded-pill me-lg-2 mb-1 mb-lg-0 ${
            location.pathname === to ? "bg-primary text-white" : "text-dark"
          }`}
        >
          {icon}
          <span>{label}</span>
          {badge > 0 && (
            <Badge
              bg={location.pathname === to ? "light" : "warning"}
              text="dark"
              className="ms-2"
              title="Cuotas de venta por cobrar"
            >
              {badge}
            </Badge>
          )}
        </Nav.Link>
      ))}
      <Nav.Link
        as="button"
        onClick={() => {
          onSelect?.();
          logout();
        }}
        className="d-flex align-items-center px-3 py-2 rounded-pill text-danger border-0 bg-transparent"
      >
        Cerrar sesión
      </Nav.Link>
    </>
  );

  return (
    <Navbar bg="light" expand="lg" className="shadow-sm border-bottom py-2" sticky="top">
      <Container fluid="xl">
        <Navbar.Brand as={Link} to="/" className="fw-bold text-primary d-flex align-items-center">
          <House className="me-2" size={22} />
          <span>Gestión Inmobiliaria</span>
        </Navbar.Brand>
        <Navbar.Toggle
          aria-controls="main-navbar"
          onClick={() => setMenuOpen(true)}
        />
        <Nav className="ms-auto d-none d-lg-flex align-items-center">{links()}</Nav>
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
            <Nav className="flex-column">{links(closeMenu)}</Nav>
          </Offcanvas.Body>
        </Offcanvas>
      </Container>
    </Navbar>
  );
}
