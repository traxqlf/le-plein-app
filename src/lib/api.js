import { FUELS } from "./fuels.js";

const DATASET = "prix-des-carburants-en-france-flux-instantane-v2";
const RECORDS_URL = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/${DATASET}/records`;
const GEOCODE_URL = "https://data.geopf.fr/geocodage/search";

const PAGE_SIZE = 100; // maximum autorisé par l'API Opendatasoft
// Paris dans 20 km ≈ 415 stations : on prend une marge confortable pour les
// zones denses. Le tri par distance garantit que, même en cas de plafond,
// ce sont les plus lointaines (jamais les plus proches) qui sont écartées.
const MAX_STATIONS = 1000;

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */
/* Les champs de l'API ont été écrits d'après le modèle « v2 améliorée » :
 *   <carburant>_prix, <carburant>_maj, carburants_rupture_temporaire,
 *   carburants_rupture_definitive, carburants_indisponibles, geom, adresse, ville, cp…
 * Si un champ change de nom, c'est CE fichier (et seulement lui) qu'il faut adapter.
 * Testez dans la console d'API : https://data.economie.gouv.fr/api/explore/v2.1/console
 */

const normKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES = { sp95e10: "e10" };

// Accepte un tableau ["Gazole", "SP95"] ou une chaîne "Gazole;SP95".
function toFuelKeys(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(/[;,|]/);
  return list
    .map(normKey)
    .filter(Boolean)
    .map((k) => ALIASES[k] ?? k);
}

// Anciennes données : coordonnées en « degrés × 100 000 ».
const scaleCoord = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.abs(n) > 180 ? n / 100000 : n;
};

const isYes = (v) => v === true || /^(oui|yes|true|1)$/i.test(String(v ?? ""));

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(/\/\/|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeStation(r) {
  // geom est normalement { lat, lon }, mais on accepte aussi le GeoJSON
  // { coordinates: [lon, lat] } et les champs latitude/longitude historiques
  // (degrés × 100 000) : sinon des stations valides seraient jetées.
  const coords = Array.isArray(r.geom?.coordinates) ? r.geom.coordinates : null;
  const lat = Number(r.geom?.lat ?? coords?.[1] ?? r.geo_point_2d?.lat ?? scaleCoord(r.latitude));
  const lon = Number(r.geom?.lon ?? coords?.[0] ?? r.geo_point_2d?.lon ?? scaleCoord(r.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const temporary = toFuelKeys(r.carburants_rupture_temporaire);
  const permanent = toFuelKeys(r.carburants_rupture_definitive);
  const unavailable = toFuelKeys(r.carburants_indisponibles);

  const fuels = {};
  for (const { key } of FUELS) {
    const rawPrice = Number(r[`${key}_prix`]);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;

    let status = "absent";
    if (permanent.includes(key)) status = "permanent";
    else if (temporary.includes(key)) status = "temporary";
    else if (unavailable.includes(key)) status = "unavailable";
    else if (price !== null) status = "available";

    fuels[key] = { price, status, updatedAt: r[`${key}_maj`] ?? null };
  }

  return {
    id: String(r.id ?? `${lat},${lon}`),
    lat,
    lon,
    // L'API officielle ne fournit pas l'enseigne aujourd'hui, mais on lit
    // le champ au cas où le schéma l'ajouterait un jour (cf. src/lib/osm.js).
    brand: r.enseigne ?? r.marque ?? r.brand ?? null,
    // Tendance du prix : calculée localement à partir de l'historique des
    // relevés (cf. src/lib/history.js). null tant qu'il n'y a pas 12 h d'écart.
    trend: null,
    address: r.adresse ?? "Adresse inconnue",
    city: r.ville ?? "",
    postcode: r.cp ?? "",
    highway: String(r.pop ?? "").toUpperCase() === "A",
    open24: isYes(r.horaires_automate_24_24 ?? r.automate_24_24),
    services: toList(r.services_service),
    fuels,
  };
}

/** Vrai si aucun champ de prix n'a été reconnu (le schéma a probablement changé). */
export function looksLikeSchemaChange(records) {
  if (!records.length) return false;
  const sample = records[0];
  return !FUELS.some(({ key }) => `${key}_prix` in sample);
}

/* -------------------------------------------------------------------------- */
/* Appels réseau                                                              */
/* -------------------------------------------------------------------------- */

export async function fetchStations({ lat, lon, radiusKm, signal }) {
  const point = `geom'POINT(${lon} ${lat})'`;
  const where = `within_distance(geom, ${point}, ${radiusKm}km)`;
  // Tri du plus proche au plus lointain : pagination stable (pas de doublons
  // ni de trous entre les pages) et, si le plafond MAX_STATIONS est atteint,
  // seules les stations les plus éloignées manquent — jamais les proches.
  const order_by = `distance(geom, ${point})`;
  const records = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total && offset < MAX_STATIONS) {
    const remaining = MAX_STATIONS - offset;
    const params = new URLSearchParams({
      where,
      order_by,
      limit: String(Math.min(PAGE_SIZE, remaining)),
      offset: String(offset),
    });
    const res = await fetch(`${RECORDS_URL}?${params}`, { signal });
    if (!res.ok) throw new Error(`Le service des prix ne répond pas (erreur ${res.status}).`);
    const data = await res.json();
    total = data.total_count ?? 0;
    if (!data.results?.length) break;
    records.push(...data.results);
    offset += PAGE_SIZE;
  }

  const seen = new Set();
  const stations = [];
  for (const r of records) {
    const s = normalizeStation(r);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      stations.push(s);
    }
  }
  return stations;
}

/** Recherche d'une commune (géocodeur de la Géoplateforme, gratuit, sans clé). */
export async function searchPlaces(query, signal) {
  const params = new URLSearchParams({ q: query, limit: "5", type: "municipality" });
  const res = await fetch(`${GEOCODE_URL}?${params}`, { signal });
  if (!res.ok) throw new Error("Recherche indisponible.");
  const data = await res.json();
  return (data.features ?? []).map((f) => ({
    label: f.properties?.city ?? f.properties?.label ?? "Lieu",
    detail: [f.properties?.postcode, f.properties?.context].filter(Boolean).join(", "),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));
}
