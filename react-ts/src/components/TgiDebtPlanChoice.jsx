import { Alert, Button } from "react-bootstrap";

export default function TgiDebtPlanChoice({ overdue = [], onChoose, busy = false }) {
  const months = (overdue || []).join(", ");
  return (
    <Alert variant="warning" className="mb-0">
      <p className="mb-2">
        El SIAT muestra TGI atrasado{months ? ` (${months})` : ""}. ¿Cómo lo cobramos?
      </p>
      <div className="d-flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onChoose("two_installments")}
        >
          Dos cuotas: mes actual y el vencido más antiguo
        </Button>
        <Button
          size="sm"
          variant="outline-primary"
          disabled={busy}
          onClick={() => onChoose("proportional")}
        >
          Proporcional
        </Button>
      </div>
      <div className="small mt-2">
        El proporcional todavía no reparte la deuda. Por ahora se carga solo el TGI del mes.
      </div>
    </Alert>
  );
}
