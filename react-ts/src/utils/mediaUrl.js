export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const api = import.meta.env.VITE_API_URL || "";
  try {
    if (api.startsWith("http")) {
      return `${new URL(api).origin}${path}`;
    }
  } catch (_) {}
  return path;
}
