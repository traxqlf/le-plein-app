/* -------------------------------------------------------------------------- */
/* Enseignes via OpenStreetMap (Overpass)                                      */
/* -------------------------------------------------------------------------- */
/* L'API officielle des prix ne fournit pas l'enseigne. On interroge donc    */
/* Overpass pour les `amenity=fuel` proches de chaque station et on récupère */
/* leurs tags brand/operator/name. Requêtes groupées (40 stations max),       */
/* cache localStorage de 30 jours, échec toujours silencieux : sans enseigne, */
/* l'appli fonctionne exactement comme avant.                                 */

import { haversineKm } from "./geo.js";

// Instance principale + miroir de secours : Overpass est un service
// communautaire parfois saturé (le navigateur envoie son User-Agent,
// contrairement à curl/node sans UA qui reçoivent un 406).
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const CACHE_KEY = "leplein:osm-brands:v1";
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const CHUNK_SIZE = 40;
// Rayon de recherche large : les coordonnées officielles sont parfois
// arrondies à ~500 m près. L'appariement se fait d'abord par identifiant
// officiel (tag OSM `ref:FR:prix-carburants`), la distance n'est qu'un repli.
const SEARCH_RADIUS_M = 700;
const MATCH_RADIUS_KM = 0.2;
const REF_TAG = "ref:FR:prix-carburants";
const FETCH_TIMEOUT_MS = 25000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const map = new Map();
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && now - (entry.t ?? 0) < CACHE_TTL_MS) map.set(id, entry);
    }
    return map;
  } catch {
    return new Map();
  }
}

export function loadBrandCache() {
  return readCache();
}

export function saveBrandCache(map) {
  try {
    const obj = {};
    for (const [id, entry] of map) obj[id] = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* stockage indisponible (navigation privée) : tant pis */
  }
}

function buildQuery(stations) {
  const parts = stations.flatMap((s) => [
    `node(around:${SEARCH_RADIUS_M},${s.lat},${s.lon})[amenity=fuel];`,
    `way(around:${SEARCH_RADIUS_M},${s.lat},${s.lon})[amenity=fuel];`,
  ]);
  return `[out:json][timeout:25];(${parts.join("")});out center tags;`;
}

async function fetchChunk(stations, signal) {
  const body = `data=${encodeURIComponent(buildQuery(stations))}`;
  let lastError = null;
  for (const url of OVERPASS_ENDPOINTS) {
    if (signal?.aborted) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status} sur ${new URL(url).hostname}`);
      const data = await res.json();
      return data.elements ?? [];
    } catch (err) {
      lastError = err; // on tente le miroir suivant
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastError ?? new Error("Overpass indisponible.");
}

function elementLatLon(el) {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat, lon: el.lon };
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

/**
 * Associe à chaque station (id, lat, lon) ses tags OSM { brand, operator, name }.
 * Les morceaux sont interrogés EN PARALLÈLE (logos en quelques secondes, pas
 * en minutes) avec repli sur un miroir. `onChunk` (optionnel) reçoit chaque
 * morceau dès qu'il arrive pour un affichage progressif : les premiers logos
 * s'affichent sans attendre les morceaux les plus lents.
 * Retourne un Map id -> tags.
 * N'échoue jamais : en cas d'erreur, Map vide ou partielle.
 */
export async function fetchOsmTagsForStations(stations, signal, onChunk) {
  const found = new Map();
  if (!stations.length) return found;

  const matchChunk = (chunk, elements) => {
    const local = new Map();
    for (const station of chunk) {
      // 1. Appariement exact par identifiant officiel (insensible aux coordonnées).
      // 2. Repli : l'objet OSM `amenity=fuel` le plus proche (200 m max).
      const byRef =
        elements.find(
          (el) => el.tags?.[REF_TAG] != null && String(el.tags[REF_TAG]) === String(station.id),
        ) ?? null;
      let best = byRef;
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
        if (brand || operator || name) local.set(station.id, { brand, operator, name });
      }
    }
    return local;
  };

  const chunks = [];
  for (let i = 0; i < stations.length; i += CHUNK_SIZE) chunks.push(stations.slice(i, i + CHUNK_SIZE));

  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      if (signal?.aborted) return new Map();
      const elements = await fetchChunk(chunk, signal);
      const local = matchChunk(chunk, elements);
      if (local.size > 0) {
        for (const [id, tags] of local) found.set(id, tags);
        try {
          onChunk?.(local);
        } catch {
          /* rappel d'affichage : ne doit jamais faire échouer la recherche */
        }
      }
      return local;
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const [id, tags] of r.value) found.set(id, tags);
    }
  }
  return found;
}
