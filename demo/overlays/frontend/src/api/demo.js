export async function resetDemoData() {
  const token = localStorage.getItem("authToken");
  const url = `${import.meta.env.VITE_API_URL}/demo/reset`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      "Content-Type": "application/json",
    },
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(text || "Reset failed");
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Reset failed");
  }
  return data;
}
