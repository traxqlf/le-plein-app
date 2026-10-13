import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStation, looksLikeSchemaChange } from "./api.js";
import { detectBrand, normalizeBrandText } from "./brands.js";
import { FUELS, fuelColors } from "./fuels.js";
import { splitPrice, formatDelta, formatAge, formatPriceFull } from "./format.js";
import { haversineKm, formatDistance, navUrls, NAV_APP_IDS } from "./geo.js";
import { loadHistory, recordPrices, getTrend } from "./history.js";
import {
  parseDecimalInput,
  costForLiters,
  litersForCost,
  formatLiters,
  formatEuros,
} from "./calc.js";
import { normalizeTheme, resolveTheme, nextTheme } from "./theme.js";
import { ACCENTS, DEFAULT_ACCENT, normalizeAccent } from "./accent.js";
import { fetchOsmTagsForStations } from "./osm.js";

const record = {
  id: 11000001,
  adresse: "12 avenue de la Gare",
  ville: "Carcassonne",
  cp: "11000",
  pop: "R",
  geom: { lon: 2.35, lat: 43.21 },
  gazole_prix: 2.389,
  gazole_maj: "2026-09-19T08:00:00+00:00",
  e10_prix: 2.153,
  sp98_prix: 2.291,
  carburants_rupture_temporaire: ["SP98"],
  carburants_rupture_definitive: "E85",
  carburants_indisponibles: "SP98;E85",
  horaires_automate_24_24: "Oui",
  services_service: "Boutique alimentaire//Lavage automatique",
};

test("normalizeStation : statuts de disponibilité", () => {
  const s = normalizeStation(record);
  assert.equal(s.fuels.e10.status, "available");
  assert.equal(s.fuels.gazole.status, "available");
  assert.equal(s.fuels.sp98.status, "temporary"); // rupture prioritaire sur le prix
  assert.equal(s.fuels.e85.status, "permanent");
  assert.equal(s.fuels.gplc.status, "absent");
  assert.equal(s.fuels.sp98.price, 2.291); // le prix reste disponible à titre indicatif
});

test("normalizeStation : champs généraux", () => {
  const s = normalizeStation(record);
  assert.equal(s.id, "11000001");
  assert.equal(s.lat, 43.21);
  assert.equal(s.open24, true);
  assert.equal(s.highway, false);
  assert.deepEqual(s.services, ["Boutique alimentaire", "Lavage automatique"]);
});

test("normalizeStation : coordonnées à l'ancien format (degrés × 100000)", () => {
  const s = normalizeStation({ id: 1, latitude: "4321000", longitude: "235000", e10_prix: 2 });
  assert.equal(s.lat, 43.21);
  assert.equal(s.lon, 2.35);
});

test("normalizeStation : sans coordonnées -> null", () => {
  assert.equal(normalizeStation({ id: 2 }), null);
});

test("looksLikeSchemaChange", () => {
  assert.equal(looksLikeSchemaChange([record]), false);
  assert.equal(looksLikeSchemaChange([{ id: 1, prix: 2 }]), true);
  assert.equal(looksLikeSchemaChange([]), false);
});

test("splitPrice / formatPriceFull / formatDelta", () => {
  assert.deepEqual(splitPrice(1.789), { main: "1,78", sup: "9" });
  assert.deepEqual(splitPrice(2.1), { main: "2,10", sup: "0" });
  assert.equal(formatPriceFull(2.153), "2,153 €");
  assert.equal(formatDelta(0.036), "+3,6 c/L");
});

test("formatAge", () => {
  const now = Date.parse("2026-09-19T12:00:00Z");
  assert.equal(formatAge("2026-09-19T11:59:00Z", now), "à l'instant");
  assert.equal(formatAge("2026-09-19T11:48:00Z", now), "il y a 12 min");
  assert.equal(formatAge("2026-09-19T09:00:00Z", now), "il y a 3 h");
  assert.equal(formatAge("2026-09-17T12:00:00Z", now), "il y a 2 j");
  assert.equal(formatAge(null, now), null);
  assert.equal(formatAge("pas une date", now), null);
});

test("haversineKm / formatDistance", () => {
  const paris = { lat: 48.8566, lon: 2.3522 };
  const lyon = { lat: 45.764, lon: 4.8357 };
  const d = haversineKm(paris, lyon);
  assert.ok(d > 388 && d < 393, `distance Paris-Lyon inattendue : ${d}`);
  assert.equal(formatDistance(0.35), "400 m");
  assert.equal(formatDistance(2.46), "2,5 km");
  assert.equal(formatDistance(14.2), "14 km");
});

test("detectBrand : grandes enseignes françaises", () => {
  assert.equal(detectBrand("TotalEnergies")?.id, "totalenergies");
  assert.equal(detectBrand("TOTAL ACCESS")?.id, "total-access");
  assert.equal(detectBrand("E.LECLERC")?.id, "leclerc");
  assert.equal(detectBrand("Intermarché")?.id, "intermarche");
  assert.equal(detectBrand("Carrefour Market")?.id, "carrefour");
  assert.equal(detectBrand("Système U")?.id, "systeme-u");
  assert.equal(detectBrand("Super U")?.id, "systeme-u");
  assert.equal(detectBrand("Esso Express")?.id, "esso");
  assert.equal(detectBrand("Eni")?.id, "eni");
  assert.equal(detectBrand("Agip")?.id, "eni");
  assert.equal(detectBrand("bp")?.id, "bp");
  assert.equal(detectBrand("Avia")?.id, "avia");
  assert.equal(detectBrand("Géant Casino")?.id, "casino");
  // Plusieurs candidats (tags OSM brand + operator + name) : le premier motif gagne.
  assert.equal(detectBrand(null, "Station-service", "INTERMARCHE")?.id, "intermarche");
  // Logos : URL vérifiée Wikimedia Commons quand elle existe, sinon null (monogramme).
  assert.ok(
    detectBrand("TotalEnergies")?.logo?.startsWith("https://thumb.wikimedia.org/"),
    "TotalEnergies devrait avoir un logo",
  );
  assert.ok(
    detectBrand("E.LECLERC")?.logo?.startsWith("https://thumb.wikimedia.org/"),
    "E.Leclerc devrait avoir un logo",
  );
  assert.equal(detectBrand("Carrefour Market")?.logo, null); // pas de logo vérifié -> monogramme
  assert.equal(detectBrand("Garage du centre")?.logo, undefined);
  // Inconnues et vides -> null, jamais d'exception.
  assert.equal(detectBrand("Garage du centre"), null);
  assert.equal(detectBrand(null, undefined, ""), null);
  assert.equal(normalizeBrandText("Élan"), "elan");
});

test("normalizeStation : enseigne conservée quand présente", () => {
  assert.equal(normalizeStation(record).brand, null); // l'API officielle n'en fournit pas
  assert.equal(normalizeStation({ ...record, enseigne: "Total" }).brand, "Total");
});

test("calculateur : parseDecimalInput (virgule, point, unités)", () => {
  assert.equal(parseDecimalInput("35"), 35);
  assert.equal(parseDecimalInput("12,5"), 12.5);
  assert.equal(parseDecimalInput("12.5"), 12.5);
  assert.equal(parseDecimalInput("12,"), 12); // tolérant pendant la frappe
  assert.equal(parseDecimalInput("50 €"), 50);
  assert.equal(parseDecimalInput("33 L"), 33);
  assert.equal(parseDecimalInput(""), null);
  assert.equal(parseDecimalInput("  "), null);
  assert.equal(parseDecimalInput("abc"), null);
  assert.equal(parseDecimalInput("-5"), null);
  assert.equal(parseDecimalInput("12,5,3"), null);
});

test("calculateur : conversions litres <-> euros", () => {
  assert.equal(costForLiters(40, 1.789), 71.56); // arrondi au centime
  assert.equal(costForLiters(0, 1.789), 0);
  assert.equal(costForLiters(40, null), null);
  assert.equal(litersForCost(50, 1.789), 27.95);
  assert.equal(litersForCost(0, 1.789), 0);
  assert.equal(litersForCost(50, 0), null);
  assert.equal(formatLiters(27.948), "27,95");
  assert.equal(formatEuros(71.5), "71,50");
});

test("GPS : deep links avec les coordonnées de la station", () => {
  const urls = navUrls(48.8566, 2.3522);
  assert.deepEqual(urls.map((u) => u.id), ["google", "waze", "apple"]);
  assert.deepEqual(urls.map((u) => u.id).sort(), [...NAV_APP_IDS].sort());
  const byId = Object.fromEntries(urls.map((u) => [u.id, u.url]));
  assert.ok(byId.google.includes("48.8566,2.3522"), "Google Maps doit contenir lat,lon");
  assert.ok(byId.waze.includes("ll=48.8566,2.3522") && byId.waze.includes("navigate=yes"));
  assert.ok(byId.apple.includes("daddr=48.8566,2.3522"));
});

test("tendances : enregistrement et calcul 24 h / 48 h", () => {
  const H = 3600 * 1000;
  const now = Date.parse("2026-09-20T12:00:00Z");
  const station = (price) => ({ id: "1", fuels: { e10: { price, status: "available" } } });

  let history = recordPrices({}, [station(1.8)], now - 30 * H);
  assert.equal(getTrend(history, "1", "e10", now), null); // un seul relevé -> rien

  history = recordPrices(history, [station(1.821)], now);
  const up = getTrend(history, "1", "e10", now);
  assert.equal(up?.direction, "up");
  assert.equal(up?.text, "+2,1 cts/24 h");

  history = recordPrices({}, [station(1.9)], now - 40 * H);
  history = recordPrices(history, [station(1.892)], now);
  const down = getTrend(history, "1", "e10", now);
  assert.equal(down?.direction, "down");
  assert.equal(down?.text, "-0,8 cts/48 h");

  history = recordPrices({}, [station(1.8)], now - 20 * H);
  history = recordPrices(history, [station(1.8)], now);
  assert.deepEqual(getTrend(history, "1", "e10", now), { direction: "flat", text: "stable" });

  // Trop récent (< 12 h d'écart) -> pas de tendance.
  history = recordPrices({}, [station(1.8)], now - 5 * H);
  history = recordPrices(history, [station(1.9)], now);
  assert.equal(getTrend(history, "1", "e10", now), null);

  // Prix manquant ignoré, entrées invalides filtrées au chargement.
  history = recordPrices({}, [{ id: "2", fuels: { e10: { price: null } } }], now);
  assert.equal(getTrend(history, "2", "e10", now), null);
  assert.deepEqual(loadHistory(), {}); // sans localStorage (node) -> objet vide
});

test("thème : normalisation, résolution et rotation", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("clair"), "system"); // valeur périmée -> automatique
  assert.equal(normalizeTheme(null), "system");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light"); // le choix manuel gagne
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(nextTheme("system"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "system");
  assert.equal(nextTheme("inconnu"), "light"); // périmé -> repart sur clair
});

test("accent : 5 couleurs normalisées", () => {
  assert.equal(ACCENTS.length, 5);
  assert.deepEqual(
    ACCENTS.map((a) => a.id),
    ["blue", "purple", "pink", "orange", "green"],
  );
  assert.equal(DEFAULT_ACCENT, "blue");
  for (const a of ACCENTS) {
    assert.match(a.swatch, /^#[0-9a-fA-F]{6}$/, `${a.id} doit avoir un swatch hexadécimal`);
  }
  assert.deepEqual(
    new Set(ACCENTS.map((a) => a.id)).size,
    5,
    "identifiants uniques",
  );
  assert.equal(normalizeAccent("pink"), "pink");
  assert.equal(normalizeAccent("turquoise"), "blue"); // inconnu -> défaut
  assert.equal(normalizeAccent(null), "blue");
});

test("carburants : chaque carburant a sa couleur officielle", () => {
  assert.equal(FUELS.length, 6);
  for (const f of FUELS) {
    assert.match(f.color, /^#[0-9a-fA-F]{6}$/, `${f.key} : couleur hexadécimale`);
    assert.match(f.ink, /^#[0-9a-fA-F]{6}$/, `${f.key} : encre hexadécimale`);
    assert.deepEqual(fuelColors(f.key), { bg: f.color, fg: f.ink });
  }
  assert.deepEqual(new Set(FUELS.map((f) => f.color)).size, 6, "couleurs distinctes");
  assert.deepEqual(fuelColors("inconnu"), { bg: "#6b7280", fg: "#ffffff" });
});

test("enseignes OSM : appariement ref + proximité, rappel par morceau", async () => {
  const canned = {
    elements: [
      {
        type: "node",
        id: 1,
        lat: 48.85,
        lon: 2.35,
        tags: { amenity: "fuel", brand: "TotalEnergies", "ref:FR:prix-carburants": "75001003" },
      },
      {
        type: "node",
        id: 2,
        lat: 45.781,
        lon: 4.801,
        tags: { amenity: "fuel", operator: "Intermarché" },
      },
    ],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => canned });
  try {
    const chunks = [];
    const found = await fetchOsmTagsForStations(
      [
        { id: "75001003", lat: 48.86, lon: 2.35 },
        { id: "69009003", lat: 45.781, lon: 4.801 },
      ],
      undefined,
      (local) => chunks.push(local),
    );
    // Appariement par identifiant officiel (insensible à la distance : ~1 km ici)…
    assert.equal(found.get("75001003")?.brand, "TotalEnergies");
    // …repli sur l'objet le plus proche (200 m max, ici 0 m).
    assert.equal(found.get("69009003")?.operator, "Intermarché");
    // Un seul morceau (< 40 stations), notifié aussitôt au lieu d'attendre.
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].get("75001003")?.brand, "TotalEnergies");
    assert.deepEqual(await fetchOsmTagsForStations([], undefined), new Map());
  } finally {
    globalThis.fetch = realFetch;
  }
});
