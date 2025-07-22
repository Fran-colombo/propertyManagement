import { Navbar, Nav, Container } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import {
  House,
  People,
  Building,
  CashStack,
  FileEarmarkText,
} from "react-bootstrap-icons";

export default function NavigationBar() {
  const location = useLocation();

  const navItems = [
    { to: "/people", icon: <People className="me-2" />, label: "Personas" },
    { to: "/properties", icon: <Building className="me-2" />, label: "Propiedades" },
    { to: "/transactions", icon: <CashStack className="me-2" />, label: "Transacciones" },
    { to: "/contracts", icon: <FileEarmarkText className="me-2" />, label: "Contratos activos" },
    { to: "/all-contracts", icon: <FileEarmarkText className="me-2" />, label: "Historial de contratos" },
  ];

  return (
    <Navbar bg="light" expand="lg" className="shadow-sm border-bottom py-3">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-bold text-primary d-flex align-items-center">
          <House className="me-2" size={24} />
          <span className="fs-5">Gestión Inmobiliaria</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-navbar" />
        <Navbar.Collapse id="main-navbar">
          <Nav className="ms-auto">
            {navItems.map(({ to, icon, label }) => (
              <Nav.Link
                as={Link}
                to={to}
                key={to}
                active={location.pathname === to}
                className={`d-flex align-items-center px-3 rounded-pill me-2 ${
                  location.pathname === to ? "bg-primary text-white" : "text-dark"
                }`}
                style={{ transition: "all 0.3s" }}
              >
                {icon}
                <span>{label}</span>
              </Nav.Link>
            ))}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
