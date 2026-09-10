import { apiFetch } from "./clients";

export async function getReceiptSignature() {
  return await apiFetch("/settings/receipt-signature");
}

export async function uploadReceiptSignature(file) {
  const form = new FormData();
  form.append("signature", file);
  return await apiFetch("/settings/receipt-signature", {
    method: "POST",
    body: form,
  });
}

export async function deleteReceiptSignature() {
  return await apiFetch("/settings/receipt-signature", {
    method: "DELETE",
  });
}
