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