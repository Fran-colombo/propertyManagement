import { Container } from "react-bootstrap";
import NavigationBar from "./NavBar";
import DemoBanner from "./DemoBanner";

export default function Layout({ children }) {
  return (
    <>
      <DemoBanner />
      <NavigationBar />
      <main className="py-4">
        <Container>
          {children}
        </Container>
      </main>
    </>
  );
}
