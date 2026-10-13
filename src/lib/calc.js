/* -------------------------------------------------------------------------- */
/* Calculateur de plein : conversions litres <-> euros                        */
/* -------------------------------------------------------------------------- */

/** Accepte « 12,5 », « 12.5 », « 50 € », « 33 L »… Retourne un nombre >= 0 ou null. */
export function parseDecimalInput(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text
    .replace(/\s+/g, "")
    .replace(/[^0-9,.\-]/g, "")
    .replace(",", ".");
  // Tolérant pendant la frappe : « 12, » (= « 12. ») vaut déjà 12.
  if (!/^-?\d+\.?\d*$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Arrondi au centime (ce que paie vraiment l'automobiliste). */
const roundCents = (n) => Math.round(n * 100) / 100;

/** Coût en € pour un volume en L à un prix au litre. */
export function costForLiters(liters, price) {
  if (!(liters >= 0) || !(price > 0)) return null;
  return roundCents(liters * price);
}

/** Volume en L (2 décimales, comme l'afficheur de la pompe) pour un montant en €. */
export function litersForCost(amount, price) {
  if (!(amount >= 0) || !(price > 0)) return null;
  return Math.round((amount / price) * 100) / 100;
}

/** « 33,33 » (2 décimales max, virgule française). */
export function formatLiters(n) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/** « 55,20 » (toujours 2 décimales, sans le symbole €). */
export function formatEuros(n) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
