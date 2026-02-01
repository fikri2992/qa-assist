export function mapSessionStatus(status) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "ended" || normalized === "completed") {
    return { label: "completed", className: "completed", badgeClass: "success" };
  }
  if (normalized === "failed") {
    return { label: "failed", className: "failed", badgeClass: "error" };
  }
  if (normalized === "recording") {
    return { label: "recording", className: "recording", badgeClass: "info" };
  }
  if (normalized === "paused") {
    return { label: "paused", className: "paused", badgeClass: "warning" };
  }

  const fallback = normalized || "unknown";
  return { label: fallback, className: "unknown", badgeClass: "default" };
}
