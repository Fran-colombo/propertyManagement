import { Container } from "react-bootstrap";
import NavigationBar from "./Navbar";

export default function Layout({ children }) {
  return (
    <>
      <NavigationBar />
      <main className="py-4">
        <Container>
          {children}
        </Container>
      </main>
    </>
  );
}