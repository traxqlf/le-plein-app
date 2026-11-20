/* -------------------------------------------------------------------------- */
/* Historique local des prix relevés (tendances ↘ ↗)                          */
/* -------------------------------------------------------------------------- */
/* L'API officielle ne fournit aucun historique : on mémorise ici chaque prix */
/* relevé (par station et par carburant, horodaté) pour calculer une vraie    */
/* tendance 24 h / 48 h. Sans au moins 12 h d'écart entre deux relevés, il    */
/* n'y a pas de tendance — on n'affiche rien plutôt que d'inventer.           */

export interface PriceEntry {
  p: number;
  at: number;
}

export type PriceHistory = Record<string, Record<string, PriceEntry[]>>;

export interface PriceTrend {
  direction: "up" | "down" | "flat";
  text: string;
}

/** Station minimale pour enregistrer un relevé (prix par carburant). */
export interface PricedStation {
  id: string;
  fuels?: Record<string, { price?: number | null } | null | undefined> | null | undefined;
}

const KEY = "leplein:price-history:v1";
const RETENTION_MS = 48 * 3600 * 1000; // on ne compare jamais au-delà de 48 h
const MIN_SPAN_MS = 12 * 3600 * 1000; // écart minimal pour parler de tendance
const MIN_RECORD_GAP_MS = 60 * 60 * 1000; // pas de doublon si prix inchangé < 1 h
const MAX_PER_KEY = 32; // garde-fou par (station, carburant)
const MAX_TOTAL = 10000; // garde-fou global (localStorage)

const isEntry = (e: unknown): e is PriceEntry => {
  if (!e || typeof e !== "object") return false;
  const entry = e as Partial<PriceEntry>;
  return (
    typeof entry.p === "number" &&
    Number.isFinite(entry.p) &&
    entry.p > 0 &&
    typeof entry.at === "number" &&
    Number.isFinite(entry.at) &&
    entry.at > 0
  );
};

export function loadHistory(): PriceHistory {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const history: PriceHistory = {};
    for (const [stationId, fuels] of Object.entries(parsed as Record<string, unknown>)) {
      if (!fuels || typeof fuels !== "object") continue;
      for (const [fuel, entries] of Object.entries(fuels as Record<string, unknown>)) {
        const kept = (Array.isArray(entries) ? entries : []).filter(isEntry);
        if (kept.length) (history[stationId] ??= {})[fuel] = kept;
      }
    }
    return history;
  } catch {
    return {};
  }
}

export function saveHistory(history: PriceHistory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    /* quota atteint : on garde l'historique en mémoire pour la session */
  }
}

function pruneEntries(entries: PriceEntry[], now: number): PriceEntry[] {
  return entries.filter((e) => now - e.at <= RETENTION_MS).slice(-MAX_PER_KEY);
}

/** Ajoute un relevé (prix du fetch `at`) ; ne duplique pas un prix inchangé récent. */
export function recordPrices(
  history: PriceHistory,
  stations: PricedStation[] | null | undefined,
  at: number = Date.now(),
): PriceHistory {
  const next: PriceHistory = { ...history };
  for (const s of stations ?? []) {
    for (const [fuel, offer] of Object.entries(s.fuels ?? {})) {
      if (offer?.price == null) continue;
      const key = `${s.id}`;
      const entries = [...(next[key]?.[fuel] ?? [])];
      const last = entries[entries.length - 1];
      if (last && last.p === offer.price && at - last.at < MIN_RECORD_GAP_MS) continue;
      entries.push({ p: offer.price, at });
      (next[key] ??= {})[fuel] = pruneEntries(entries, at);
    }
  }
  // Plafond global : on évince les relevés les plus anciens en premier.
  let total = Object.values(next).reduce(
    (n, fuels) => n + Object.values(fuels).reduce((m, e) => m + e.length, 0),
    0,
  );
  if (total > MAX_TOTAL) {
    const all: Array<{ sid: string; fuel: string; i: number; at: number }> = [];
    for (const [sid, fuels] of Object.entries(next)) {
      for (const [fuel, entries] of Object.entries(fuels)) {
        for (let i = 0; i < entries.length; i++) all.push({ sid, fuel, i, at: entries[i].at });
      }
    }
    all.sort((a, b) => a.at - b.at);
    const drop = new Set(all.slice(0, total - MAX_TOTAL).map((e) => `${e.sid}${e.fuel}:${e.i}`));
    for (const [sid, fuels] of Object.entries(next)) {
      for (const [fuel, entries] of Object.entries(fuels)) {
        next[sid][fuel] = entries.filter((_, i) => !drop.has(`${sid}${fuel}:${i}`));
      }
    }
  }
  return next;
}

const formatCts = (cts: number): string => {
  const sign = cts > 0 ? "+" : cts < 0 ? "-" : "";
  return `${sign}${Math.abs(cts).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
};

/**
 * Tendance réelle { direction: "up" | "down" | "flat", text: "+2,1 cts/24 h" }
 * ou null (pas assez d'historique). Référence = relevé le plus récent vieux
 * d'au moins 12 h ; fenêtre « 48 h » si l'écart dépasse 36 h.
 */
export function getTrend(
  history: PriceHistory | null | undefined,
  stationId: string,
  fuel: string,
  // `now` conservé pour compatibilité d'appel : la fenêtre se déduit des horodatages.
  _now: number = Date.now(),
): PriceTrend | null {
  const entries = history?.[stationId]?.[fuel] ?? [];
  if (entries.length < 2) return null;
  const latest = entries[entries.length - 1];
  const ref = [...entries].reverse().find((e) => latest.at - e.at >= MIN_SPAN_MS);
  if (!ref) return null;
  const deltaCts = (latest.p - ref.p) * 100;
  const windowLabel = latest.at - ref.at >= 36 * 3600 * 1000 ? "48 h" : "24 h";
  if (Math.abs(deltaCts) < 0.05) return { direction: "flat", text: "stable" };
  return {
    direction: deltaCts > 0 ? "up" : "down",
    text: `${formatCts(deltaCts)} cts/${windowLabel}`,
  };
}
