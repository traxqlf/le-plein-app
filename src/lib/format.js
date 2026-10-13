/** 1.789 -> { main: "1,78", sup: "9" } : le dernier chiffre en exposant, comme sur les pylônes. */
export function splitPrice(price) {
  const [int, dec] = price.toFixed(3).split(".");
  return { main: `${int},${dec.slice(0, 2)}`, sup: dec.slice(2) };
}

export const formatPriceFull = (price) => `${price.toFixed(3).replace(".", ",")} €`;

/** Écart en centimes par litre : 0.036 -> "+3,6 c/L" */
export function formatDelta(deltaEuros) {
  return `+${(deltaEuros * 100).toFixed(1).replace(".", ",")} c/L`;
}

/** "il y a 12 min", "il y a 3 h", "il y a 2 j". Renvoie null si la date est inconnue. */
export function formatAge(input, now = Date.now()) {
  if (!input) return null;
  const t = typeof input === "number" ? input : Date.parse(input);
  if (!Number.isFinite(t)) return null;
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export const isStale = (input, now = Date.now(), days = 7) => {
  const t = Date.parse(input);
  return Number.isFinite(t) && now - t > days * 86400000;
};

/** Élision devant voyelle ou H muet : "Alès" -> true, "Lyon" -> false.
    Le H est traité comme muet (l'aspiré est indétectable ici). */
export function elideDe(label) {
  return /^[aeiouy\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u00ff\u0153\u00e6h]/i.test(
    (label ?? "").trim(),
  );
}
