/* -------------------------------------------------------------------------- */
/* Enseignes via OpenStreetMap (Overpass)                                      */
/* -------------------------------------------------------------------------- */
/* L'API officielle des prix ne fournit pas l'enseigne. On interroge donc    */
/* Overpass pour les `amenity=fuel` proches de chaque station et on récupère */
/* leurs tags brand/operator/name. UNE seule requête en boîte englobante      */
/* (stations + marge) : bien plus légère pour ce service communautaire que    */
/* des dizaines de clauses `around`, donc plus rapide et moins susceptible   */
/* d'être mise en file d'attente. Cache localStorage de 30 jours, échec       */
/* toujours silencieux : sans enseigne, l'appli fonctionne comme avant mais   */
/* sans noms ni logos (BrandBadge n'affiche rien sans enseigne reconnue).     */

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
// Proxy même-origine (fonction serverless, voir /api/overpass.js) : la requête
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

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Boîte englobante des stations + marge (ordre Overpass : sud,ouest,nord,est).
export function buildQuery(stations) {
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
  const bbox = [round6(south - dLat), round6(west - dLon), round6(north + dLat), round6(east + dLon)].join(",");
  return `[out:json][timeout:25];(node[amenity=fuel](${bbox});way[amenity=fuel](${bbox}););out center tags;`;
}

async function postQuery(url, body, signal) {
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
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function fetchViaProxy(query, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${PROXY_PATH}?data=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Proxy Overpass ${res.status}`);
    const data = await res.json();
    return data.elements ?? [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
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
 * UNE seule requête (boîte englobante) avec repli sur un miroir : les logos
 * arrivent en quelques secondes. `onChunk` (optionnel) reçoit le résultat
 * pour un affichage immédiat. Retourne un Map id -> tags.
 * N'échoue jamais : en cas d'erreur, Map vide ou partielle.
 */
export async function fetchOsmTagsForStations(stations, signal, onChunk) {
  const found = new Map();
  if (!stations.length) return found;
  if (signal?.aborted) return found;

  const query = buildQuery(stations);
  // 1. Proxy même-origine d'abord (réseau Vercel + cache bord).
  // 2. Repli : accès directs navigateur (rapides quand le réseau client va bien).
  let elements = null;
  try {
    elements = await fetchViaProxy(query, signal);
  } catch {
    /* proxy indisponible : on tente les accès directs ci-dessous */
  }
  if (!elements && !signal?.aborted) {
    const body = `data=${encodeURIComponent(query)}`;
    for (const url of OVERPASS_ENDPOINTS) {
      if (signal?.aborted) break;
      try {
        elements = await postQuery(url, body, signal);
        break; // premier miroir qui répond gagne
      } catch {
        /* on tente le miroir suivant, échec silencieux sinon */
      }
    }
  }
  if (!elements) return found;

  for (const station of stations) {
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
      if (brand || operator || name) found.set(station.id, { brand, operator, name });
    }
  }
  if (found.size > 0) {
    try {
      onChunk?.(found);
    } catch {
      /* rappel d'affichage : ne doit jamais faire échouer la recherche */
    }
  }
  return found;
}
