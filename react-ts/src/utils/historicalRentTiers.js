function pad(n) {
  return String(n).padStart(2, "0");
}

export function isoDate(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function isPastStart(startDateStr, today = startOfToday()) {
  const start = parseISODate(startDateStr);
  return !!(start && start < today);
}

export function adjustmentStep(freq) {
  const f = String(freq || "").toUpperCase();
  if (f === "TRIMESTRAL") return 3;
  if (f === "CUATRIMESTRAL") return 4;
  if (f === "SEMESTRAL") return 6;
  return 0;
}

export function shouldApplyIndex(periodStart, contractStart, freq) {
  const months =
    (periodStart.getFullYear() - contractStart.getFullYear()) * 12 +
    (periodStart.getMonth() - contractStart.getMonth());
  const step = adjustmentStep(freq);
  if (!step || months <= 0) return false;
  return months % step === 0;
}

export function buildDefaultTiers(
  startDateStr,
  frequency,
  baseRent,
  today = startOfToday()
) {
  const start = parseISODate(startDateStr);
  if (!start) return [];
  const tiers = [
    {
      from_date: isoDate(start),
      indexed_amount: baseRent !== "" && baseRent != null ? String(baseRent) : "",
    },
  ];
  const step = adjustmentStep(frequency);
  if (!step) return tiers;
  let months = 1;
  while (months <= 240) {
    const cursor = new Date(start.getFullYear(), start.getMonth() + months, 1);
    if (cursor > today) break;
    if (shouldApplyIndex(cursor, start, frequency)) {
      tiers.push({ from_date: isoDate(cursor), indexed_amount: "" });
    }
    months += 1;
  }
  return tiers;
}

export function groupPeriodsIntoTiers(periods) {
  const sorted = [...(periods || [])].sort((a, b) =>
    String(a.start_date).localeCompare(String(b.start_date))
  );
  const tiers = [];
  for (const p of sorted) {
    const amount = Number(p.indexed_amount ?? p.base_rent ?? 0);
    const last = tiers[tiers.length - 1];
    if (
      last &&
      Math.round(Number(last.indexed_amount) * 100) === Math.round(amount * 100)
    ) {
      continue;
    }
    tiers.push({
      from_date: String(p.start_date).slice(0, 10),
      indexed_amount: Number.isFinite(amount) ? String(amount) : "",
    });
  }
  return tiers;
}

export function serializeTiers(tiers) {
  return (tiers || [])
    .map((t) => ({
      from_date: t.from_date ? String(t.from_date).slice(0, 10) : "",
      indexed_amount: Number(t.indexed_amount),
    }))
    .filter(
      (t) => t.from_date && Number.isFinite(t.indexed_amount) && t.indexed_amount > 0
    );
}
