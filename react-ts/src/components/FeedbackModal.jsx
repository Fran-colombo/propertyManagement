import { Modal, Button, Alert } from "react-bootstrap";

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
}) {
  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      style={{ zIndex: 1060 }}
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant={variant} className="mb-0">
          {message}
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onClose}>
          Aceptar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
