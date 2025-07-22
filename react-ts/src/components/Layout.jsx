import { Container } from "react-bootstrap";
import Navbar from "./Navbar"; 

export default function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className="py-4">
        <Container>
          {children}
        </Container>
      </main>
    </>
  );
}