import { Alert, Button, Spinner } from "react-bootstrap";
import { useState } from "react";
import { resetDemoData } from "../api/demo";

export default function DemoBanner() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (
      !window.confirm(
        "This restores the fictional DEMO dataset. Your DEMO changes will be lost. Continue?"
      )
    ) {
      return;
    }
    try {
      setResetting(true);
      setError("");
      setMessage("");
      await resetDemoData();
      setMessage("DEMO data restored. Reloading…");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err.message || "Could not reset DEMO data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Alert variant="warning" className="mb-0 rounded-0 text-center py-2 px-2">
      <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
        <strong>DEMO ENVIRONMENT — Fictional Data</strong>
        <Button
          variant="outline-danger"
          size="sm"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? (
            <>
              <Spinner size="sm" className="me-1" /> Restoring…
            </>
          ) : (
            "Reset demo data"
          )}
        </Button>
      </div>
      {message && <div className="small mt-1">{message}</div>}
      {error && <div className="small text-danger mt-1">{error}</div>}
    </Alert>
  );
}
