import { Container } from "react-bootstrap";
import NavigationBar from "./NavBar";

export default function Layout({ children }) {
  return (
    <>
      <NavigationBar />
      <main className="py-3 py-md-4">
        <Container fluid="xl" className="px-2 px-sm-3">
          {children}
        </Container>
      </main>
    </>
  );
}
