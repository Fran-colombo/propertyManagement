import { Modal, Button, Alert } from "react-bootstrap";

/**
 * Result modal for success / error / warning after an action.
 * @param {{ show: boolean, variant?: 'success'|'danger'|'warning'|'info', title?: string, message?: string, onClose: () => void }} props
 */
export default function FeedbackModal({
  show,
  variant = "info",
  title = "",
  message = "",
  onClose,
}) {
  return (
    <Modal show={show} onHide={onClose} centered>
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
