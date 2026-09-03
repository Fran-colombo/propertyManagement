const UNITS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
];
const TEENS = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function belowHundred(n) {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n === 20) return "veinte";
  if (n < 30) return `veinti${UNITS[n - 20]}`.replace("veintiuno", "veintiuno");
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (!unit) return TENS[ten];
  return `${TENS[ten]} y ${UNITS[unit]}`;
}

function belowThousand(n) {
  if (n === 100) return "cien";
  if (n < 100) return belowHundred(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (!rest) return HUNDREDS[hundred];
  return `${HUNDREDS[hundred]} ${belowHundred(rest)}`;
}

function integerToSpanish(n) {
  const value = Math.floor(Math.abs(Number(n) || 0));
  if (value === 0) return "cero";
  if (value === 1) return "un";
  if (value < 1000) return belowThousand(value);

  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const rest = value % 1000;
  const parts = [];

  if (millions === 1) parts.push("un millón");
  else if (millions > 1) parts.push(`${belowThousand(millions)} millones`);

  if (thousands === 1) parts.push("mil");
  else if (thousands > 1) parts.push(`${belowThousand(thousands)} mil`);

  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

export function amountToSpanish(amount) {
  const n = Math.round(Math.abs(Number(amount) || 0) * 100) / 100;
  const pesos = Math.floor(n);
  const cents = Math.round((n - pesos) * 100);
  const words = integerToSpanish(pesos);
  const fraction = String(cents).padStart(2, "0");
  return `${words} con ${fraction}/100`;
}
