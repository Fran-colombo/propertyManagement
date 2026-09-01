import { Alert, Button, Form, Table } from "react-bootstrap";

export default function HistoricalRentTiers({
  tiers,
  onChange,
  disabled = false,
}) {
  const updateRow = (index, field, value) => {
    const next = tiers.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    );
    onChange(next);
  };

  const addRow = () => {
    const last = tiers[tiers.length - 1];
    onChange([
      ...tiers,
      { from_date: last?.from_date || "", indexed_amount: "" },
    ]);
  };

  const removeRow = (index) => {
    if (tiers.length <= 1) return;
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <Alert variant="info" className="py-2">
      <div className="fw-semibold mb-1">Alquiler por tramos (hasta hoy)</div>
      <Form.Text className="text-muted d-block mb-2">
        El IPC de ahora no se aplica a todos los meses viejos. Cargá el alquiler
        real de cada ajuste, como en el Excel (desde mes X vale $Y).
      </Form.Text>
      <div className="table-responsive">
        <Table size="sm" bordered className="mb-2 bg-body">
          <thead>
            <tr>
              <th>Desde</th>
              <th>Alquiler</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((row, index) => (
              <tr key={`${row.from_date}-${index}`}>
                <td>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={row.from_date || ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, "from_date", e.target.value)}
                  />
                </td>
                <td>
                  <Form.Control
                    type="number"
                    size="sm"
                    min="0"
                    step="0.01"
                    placeholder={index === 0 ? "Alquiler base" : "Alquiler de este tramo"}
                    value={row.indexed_amount}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, "indexed_amount", e.target.value)
                    }
                    onWheel={(e) => e.target.blur()}
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    variant="outline-danger"
                    size="sm"
                    disabled={disabled || tiers.length <= 1}
                    onClick={() => removeRow(index)}
                  >
                    Sacar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        disabled={disabled}
        onClick={addRow}
      >
        Agregar tramo
      </Button>
    </Alert>
  );
}
