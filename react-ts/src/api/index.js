import { apiFetch } from "./clients";

export const getIndexes = async () => {
  return await apiFetch("/indices/");
};

export const updateIndex = async (dto) => {
  return await apiFetch("/indices/", {
    method: "PUT",
    body: JSON.stringify(dto),
  });
};

/** Official IPC from datos.gob.ar (backend proxy). Optional date=YYYY-MM-DD */
export const getIpc = async (date) => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return await apiFetch(`/indices/ipc${qs}`);
};
