import { apiFetch } from "./clients";

export async function getPropertyIncome({ propertyIds, startDate, endDate }) {
  const params = new URLSearchParams();
  params.set("property_ids", (propertyIds || []).join(","));
  params.set("start_date", startDate);
  params.set("end_date", endDate);
  return await apiFetch(`/reports/property-income?${params.toString()}`);
}
