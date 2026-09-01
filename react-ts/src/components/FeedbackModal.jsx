import { Modal, Button, Alert } from "react-bootstrap";

export function FeedbackView({ variant = "info", title = "", message = "", onClose }) {
  return (
    <>
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
      />
    </Modal>
  );
}
