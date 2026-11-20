/* -------------------------------------------------------------------------- */
/* Enseignes via OpenStreetMap (Overpass)                                      */
/* -------------------------------------------------------------------------- */
/* L'API officielle des prix ne fournit pas l'enseigne. On interroge donc    */
/* OpenStreetMap : UNE requête Overpass en boîte englobante (stations + marge) */
/* pour les `amenity=fuel` proches, d'où l'on tire brand/operator/name.       */
/* Repli complémentaire : la recherche Nominatim (index OSM, service distinct */
/* d'Overpass) en UNE requête sur la même boîte englobante — elle fonctionne  */
/* quand Overpass est filtré (406) ou injoignable. Nominatim renvoie en plus  */
/* `ref:FR:prix-carburants`, donc l'appariement reste exact par identifiant.  */
/* Cache localStorage de 30 jours, échec toujours silencieux : sans enseigne, */
/* l'appli fonctionne comme avant, sans noms ni logos.                        */

import { haversineKm, type LatLon } from "./geo.ts";

// Instances de secours : Overpass est un service communautaire parfois saturé
// et, depuis 2026, l'instance principale (overpass-api.de) répond 406 aux
// clients dont le réseau ou le User-Agent ne lui convient pas. L'instance
// française d'OSM-FR et les miroirs passent par des hébergements différents :
// on les tente donc AVANT l'instance principale.
const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const CACHE_KEY = "leplein:osm-brands:v1";
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
// Proxy même-origine (fonction serverless, voir /api/overpass.ts) : la requête
// part du réseau de Vercel au lieu du navigateur, ce qui contourne les réseaux
// où l'accès direct est refusé (406 sans CORS, files d'attente). En dev local,
// /api n'existe pas : l'échec est silencieux et on passe aux accès directs.
const PROXY_PATH = "/api/overpass";
// Marge autour de la boîte englobante : les coordonnées officielles sont
// parfois arrondies à ~500 m près. L'appariement se fait d'abord par
// identifiant officiel (tag OSM `ref:FR:prix-carburants`), la distance
// n'est qu'un repli.
const SEARCH_RADIUS_M = 700;
const MATCH_RADIUS_KM = 0.2;
const REF_TAG = "ref:FR:prix-carburants";
// Repli Nominatim : index OSM distinct d'Overpass, interrogé UNE fois sur la
// boîte englobante (politique d'usage : pas de requêtes par station).
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
// Maximum accepté par l'API publique.
const NOMINATIM_LIMIT = 50;
// Court : une instance qui ne répond pas ne doit pas condamner les suivantes
// (trois tentatives restent sous une vingtaine de secondes au total).
const FETCH_TIMEOUT_MS = 8000;
// Budget d'une tentative Overpass directe : au-delà, c'est le repli Nominatim
// (lancé en parallèle) qui a déjà fourni les enseignes.
const OVERPASS_ATTEMPT_TIMEOUT_MS = 3000;

/** Station à apparier : identifiant officiel + position. */
export interface OsmStationRef {
  id: string;
  lat: number;
  lon: number;
}

export interface OsmTags {
  brand: string | null;
  operator: string | null;
  name: string | null;
}

/** Entrée de cache : tags compactés (b/o/n) + horodatage du relevé. */
export interface CachedBrand {
  t?: number;
  b: string | null;
  o: string | null;
  n: string | null;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/** Une entrée n'a de sens que si elle porte au moins une enseigne utilisable. */
function isUsableEntry(entry: unknown): entry is CachedBrand {
  if (!entry || typeof entry !== "object") return false;
  const { b, o, n } = entry as CachedBrand;
  return Boolean(b || o || n);
}

// Filet de sécurité : un cache vide ou ne contenant que des entrées sans
// enseigne est supprimé du stockage, sinon il masquerait durablement les
// prochains relevés (station considérée comme déjà enrichie).
function purgeCacheKeys(removeStorage: boolean): void {
  if (!removeStorage) return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* stockage indisponible : rien à purger */
  }
}

function readCache(): Map<string, CachedBrand> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CACHE_KEY);
  } catch {
    return new Map();
  }
  if (!raw) return new Map();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    purgeCacheKeys(true);
    return new Map();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    purgeCacheKeys(true);
    return new Map();
  }
  const now = Date.now();
  const map = new Map<string, CachedBrand>();
  for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isUsableEntry(entry)) continue;
    if (now - (entry.t ?? 0) >= CACHE_TTL_MS) continue;
    map.set(id, entry);
  }
  // `{}` (ou uniquement des entrées inutilisables/expirées) : on purge.
  if (map.size === 0) purgeCacheKeys(true);
  return map;
}

export function loadBrandCache(): Map<string, CachedBrand> {
  return readCache();
}

export function saveBrandCache(map: Map<string, CachedBrand>): void {
  const obj: Record<string, CachedBrand> = {};
  for (const [id, entry] of map) {
    // Jamais d'entrée vide : elle bloquerait tout nouveau relevé pour la station.
    if (isUsableEntry(entry)) obj[id] = entry;
  }
  try {
    // Jamais de `{}` en stockage : on retire la clé à la place.
    if (Object.keys(obj).length === 0) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* stockage indisponible (navigation privée) : tant pis */
  }
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Boîte englobante des stations + marge autour (les coordonnées officielles
 *  sont parfois arrondies à ~500 m près). */
function bboxOf(stations: OsmStationRef[]): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  let latSum = 0;
  for (const s of stations) {
    if (s.lat < south) south = s.lat;
    if (s.lat > north) north = s.lat;
    if (s.lon < west) west = s.lon;
    if (s.lon > east) east = s.lon;
    latSum += s.lat;
  }
  const meanLat = (latSum / stations.length) * (Math.PI / 180);
  const dLat = SEARCH_RADIUS_M / 111320;
  const dLon = SEARCH_RADIUS_M / (111320 * Math.max(Math.cos(meanLat), 0.2));
  return {
    south: round6(south - dLat),
    west: round6(west - dLon),
    north: round6(north + dLat),
    east: round6(east + dLon),
  };
}

// Boîte englobante des stations + marge (ordre Overpass : sud,ouest,nord,est).
export function buildQuery(stations: OsmStationRef[]): string {
  const { south, west, north, east } = bboxOf(stations);
  return `[out:json][timeout:25];(node[amenity=fuel](${south},${west},${north},${east});way[amenity=fuel](${south},${west},${north},${east}););out center tags;`;
}

/**
 * Valide une réponse Overpass/Photon avant de l'accepter : seule une réponse
 * JSON contenant un tableau `elements` est exploitable. Un index.html renvoyé
 * en 200 par un proxy mal configuré, une page d'erreur nginx ou un `{}` sont
 * rejetés ici (et ne seront donc jamais mis en cache).
 */
function parseElements(payload: unknown): OverpassElement[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("réponse Overpass invalide (objet attendu)");
  }
  const elements = (payload as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) {
    throw new Error("réponse Overpass invalide (elements doit être un tableau)");
  }
  return elements as OverpassElement[];
}

async function postQuery(
  url: string,
  body: string,
  signal: AbortSignal | undefined,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
      // Pas de Referer : Overpass filtre aussi certains référents, et cette
      // requête ne transporte aucune donnée de navigation utile.
      referrerPolicy: "no-referrer",
    });
    if (!res.ok) throw new Error(`Overpass ${res.status} sur ${new URL(url).hostname}`);
    return parseElements(await res.json());
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function fetchViaProxy(
  query: string,
  signal: AbortSignal | undefined,
): Promise<OverpassElement[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${PROXY_PATH}?data=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      referrerPolicy: "no-referrer",
    });
    if (!res.ok) throw new Error(`Proxy Overpass ${res.status}`);
    return parseElements(await res.json());
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function elementLatLon(el: OverpassElement): LatLon | null {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { lat: el.lat as number, lon: el.lon as number };
  }
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
    return { lat: el.center.lat as number, lon: el.center.lon as number };
  }
  return null;
}

/**
 * Associe à chaque station (id, lat, lon) ses tags OSM { brand, operator, name }.
 * Sources, toutes silencieuses en cas d'échec :
 *   1. proxy même-origine (production) et instances Overpass directes ;
 *   2. Nominatim (une requête bbox), lancé EN PARALLÈLE des précédentes pour
 *      que les logos s'affichent sans attendre les timeouts Overpass.
 * `onChunk` (optionnel) reçoit chaque lot dès qu'il est prêt, pour un affichage
 * immédiat. Retourne un Map id -> tags (jamais d'exception).
 */
export async function fetchOsmTagsForStations(
  stations: OsmStationRef[],
  signal?: AbortSignal,
  onChunk?: (found: Map<string, OsmTags>) => void,
): Promise<Map<string, OsmTags>> {
  const found = new Map<string, OsmTags>();
  if (!stations.length) return found;
  if (signal?.aborted) return found;

  const query = buildQuery(stations);
  // 1. Proxy même-origine (réseau Vercel + cache bord), lancé tout de suite.
  const proxyTask: Promise<OverpassElement[] | null> = fetchViaProxy(query, signal).catch(() => null);
  // 2. Nominatim démarre EN PARALLÈLE, sans attendre les miroirs Overpass : il
  //    répond en quelques centaines de ms et publie ses enseignes aussitôt
  //    (`emit`), donc les logos ne dépendent plus des timeouts Overpass.
  //    Une seule requête bbox, `limit=50` (la limite par défaut tronquerait la
  //    liste en ville), et `ref:FR:prix-carburants` pour un appariement exact.
  const nominatimTask: Promise<void> = fetchViaNominatim(stations, signal).then((extra) => {
    if (signal?.aborted || extra.length === 0) return;
    const before = new Set(found.keys());
    matchElements(
      extra,
      stations.filter((s) => !found.has(s.id)),
      found,
    );
    const delta = new Map<string, OsmTags>();
    for (const [id, tags] of found) if (!before.has(id)) delta.set(id, tags);
    emit(delta);
  });

  // 3. Overpass : proxy puis instances directes, 3 s maximum chacune. Ses tags
  //    (brand/operator) précisent ce que Nominatim a déjà pu fournir.
  let elements: OverpassElement[] | null = null;
  try {
    elements = await proxyTask;
  } catch {
    /* proxy indisponible : on tente les accès directs ci-dessous */
  }
  if (!elements && !signal?.aborted) {
    const body = `data=${encodeURIComponent(query)}`;
    for (const url of OVERPASS_ENDPOINTS) {
      if (signal?.aborted) break;
      try {
        elements = await postQuery(url, body, signal, OVERPASS_ATTEMPT_TIMEOUT_MS);
        break; // premier miroir qui répond gagne
      } catch {
        /* on tente le miroir suivant, échec silencieux sinon */
      }
    }
  }
  if (elements) {
    matchElements(elements, stations, found);
    emit(found);
  }

  // La requête Nominatim est déjà terminée dans la quasi-totalité des cas.
  await nominatimTask;

  return found;

  /** Rappel d'affichage : ne doit jamais faire échouer la recherche. */
  function emit(payload: Map<string, OsmTags>): void {
    if (payload.size === 0) return;
    try {
      onChunk?.(payload);
    } catch {
      /* rappel d'affichage : ne doit jamais faire échouer la recherche */
    }
  }
}

/**
 * Apparie des objets OSM à des stations : identifiant officiel exact d'abord,
 * puis l'objet `amenity=fuel` le plus proche (200 m max).
 */
function matchElements(
  elements: OverpassElement[],
  stations: OsmStationRef[],
  found: Map<string, OsmTags>,
): void {
  for (const station of stations) {
    const byRef =
      elements.find(
        (el) => el.tags?.[REF_TAG] != null && String(el.tags[REF_TAG]) === String(station.id),
      ) ?? null;
    let best: OverpassElement | null = byRef;
    if (!best) {
      let bestDist = MATCH_RADIUS_KM;
      for (const el of elements) {
        const pos = elementLatLon(el);
        if (!pos) continue;
        const d = haversineKm(station, pos);
        if (d < bestDist) {
          bestDist = d;
          best = el;
        }
      }
    }
    if (best?.tags) {
      const { brand = null, operator = null, name = null } = best.tags;
      if (brand || operator || name) found.set(station.id, { brand, operator, name });
    }
  }
}

/** Ligne renvoyée par la recherche Nominatim (format=jsonv2). */
interface NominatimRow {
  lat?: string;
  lon?: string;
  name?: string;
  extratags?: Record<string, string>;
}

/**
 * Repli multi-source : recherche Nominatim des `amenity=fuel` de la même boîte
 * englobante, en UNE requête (une par chargement au plus, jamais par station).
 * Réponse convertie au format Overpass pour réutiliser l'appariement commun.
 * Échec silencieux : tableau vide.
 */
async function fetchViaNominatim(
  stations: OsmStationRef[],
  signal: AbortSignal | undefined,
): Promise<OverpassElement[]> {
  const { south, west, north, east } = bboxOf(stations);
  // viewbox: lon1,lat1,lon2,lat2 (ouest,nord,est,sud)
  const params = new URLSearchParams({
    format: "jsonv2",
    amenity: "fuel",
    limit: String(NOMINATIM_LIMIT),
    bounded: "1",
    viewbox: `${west},${north},${east},${south}`,
    extratags: "1",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // `origin` : Referer = origine du site, jamais vide. La politique d'usage
      // de Nominatim exige un référent identifiant l'application, et un envoi
      // absent peut être refusé en 403.
      referrerPolicy: "origin",
    });
    if (!res.ok) return [];
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return [];
    const elements: OverpassElement[] = [];
    for (const raw of rows as NominatimRow[]) {
      const lat = Number(raw.lat);
      const lon = Number(raw.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const extra = raw.extratags ?? {};
      const tags: Record<string, string> = {};
      if (raw.name) tags.name = raw.name;
      if (extra.brand) tags.brand = extra.brand;
      if (extra.operator) tags.operator = extra.operator;
      // Identifiant officiel : permet l'appariement exact par `id` de station.
      const ref = extra[REF_TAG];
      if (ref) tags[REF_TAG] = ref;
      elements.push({ lat, lon, tags });
    }
    return elements;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
