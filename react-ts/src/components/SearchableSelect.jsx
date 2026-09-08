import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Form, ListGroup } from "react-bootstrap";

function optionValue(option) {
  return option?.value;
}

function optionLabel(option) {
  return option?.label || "";
}

function optionSearch(option) {
  return `${option?.search || option?.label || ""}`.toLowerCase();
}

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Buscar...",
  emptyText = "Sin resultados",
  disabled = false,
  multiple = false,
  allowClear = true,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value.map((v) => String(v)) : [];
    }
    return value === "" || value == null ? [] : [String(value)];
  }, [multiple, value]);

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedValues.includes(String(optionValue(o)))),
    [options, selectedValues]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return options.filter((o) => {
      if (multiple && selectedValues.includes(String(optionValue(o)))) return false;
      if (!term) return true;
      return optionSearch(o).includes(term);
    });
  }, [options, query, multiple, selectedValues]);

  useEffect(() => {
    if (open || multiple) return;
    setQuery(selectedOptions[0] ? optionLabel(selectedOptions[0]) : "");
  }, [open, multiple, selectedOptions]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (option) => {
    const next = optionValue(option);
    if (multiple) {
      onChange([...(Array.isArray(value) ? value : []), next]);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    onChange(next);
    setQuery(optionLabel(option));
    setOpen(false);
  };

  const clear = () => {
    if (multiple) {
      onChange([]);
    } else {
      onChange("");
      setQuery("");
    }
    inputRef.current?.focus();
    setOpen(true);
  };

  const removeValue = (toRemove) => {
    onChange((Array.isArray(value) ? value : []).filter((v) => String(v) !== String(toRemove)));
  };

  return (
    <div ref={wrapRef} className="position-relative">
      {multiple && selectedOptions.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {selectedOptions.map((option) => (
            <Badge bg="secondary" key={String(optionValue(option))} className="d-inline-flex align-items-center">
              {optionLabel(option)}
              <Button
                variant="link"
                size="sm"
                className="text-white p-0 ms-1"
                onClick={() => removeValue(optionValue(option))}
                aria-label={`Quitar ${optionLabel(option)}`}
              >
                ×
              </Button>
            </Badge>
          ))}
        </div>
      )}
      <div className="d-flex gap-2">
        <Form.Control
          id={id}
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            if (!multiple) setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered[0]) pick(filtered[0]);
            }
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
        {allowClear && selectedValues.length > 0 && (
          <Button
            type="button"
            variant="outline-secondary"
            onClick={clear}
            disabled={disabled}
          >
            Limpiar
          </Button>
        )}
      </div>
      {open && !disabled && (
        <ListGroup
          className="position-absolute w-100 shadow-sm mt-1"
          style={{ zIndex: 1080, maxHeight: 240, overflowY: "auto" }}
        >
          {filtered.length === 0 ? (
            <ListGroup.Item className="text-muted">{emptyText}</ListGroup.Item>
          ) : (
            filtered.map((option) => (
              <ListGroup.Item
                action
                key={String(optionValue(option))}
                active={selectedValues.includes(String(optionValue(option)))}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
              >
                {optionLabel(option)}
              </ListGroup.Item>
            ))
          )}
        </ListGroup>
      )}
    </div>
  );
}
