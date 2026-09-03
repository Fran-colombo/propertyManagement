import { Modal, Button, Alert } from "react-bootstrap";

export function FeedbackView({
  variant = "info",
  title = "",
  message = "",
  onClose,
  onGenerateReceipt,
}) {
  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant={variant} className="mb-0">
          {message}
        </Alert>
        {variant === "success" && onGenerateReceipt && (
          <p className="mt-3 mb-0">¿Generar comprobantes para imprimir? Salen las dos copias en la misma hoja.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        {variant === "success" && onGenerateReceipt && (
          <Button
            variant="outline-primary"
            onClick={() => {
              onGenerateReceipt();
            }}
          >
            Generar comprobante
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>
          {onGenerateReceipt ? "No, gracias" : "Aceptar"}
        </Button>
      </Modal.Footer>
    </>
  );
}

/**
 * Result modal for success / error / warning after an action.
 * Renders above other Bootstrap modals.
 */
export default function FeedbackModal({
  show,
  variant = "info",
  title = "",
  message = "",
  onClose,
  onGenerateReceipt,
}) {
  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      enforceFocus={false}
      restoreFocus={false}
      className="feedback-result-modal"
      backdropClassName="feedback-result-backdrop"
    >
      <FeedbackView
        variant={variant}
        title={title}
        message={message}
        onClose={onClose}
        onGenerateReceipt={onGenerateReceipt}
      />
    </Modal>
  );
}
