import { useEffect, useMemo, useState } from "react";
import { detectBrand, type BrandInfo } from "../lib/brands.ts";
import {
  fetchOsmTagsForStations,
  loadBrandCache,
  saveBrandCache,
  type OsmStationRef,
  type OsmTags,
} from "../lib/osm.ts";
import type { Station } from "../lib/api.ts";

// Nombre max de stations enrichies (les plus proches d'abord) : protège Overpass.
const MAX_ENRICH = 150;

/** Station telle que vue par ce hook : position, distance et enseigne éventuelle. */
export interface BrandStation extends Omit<Station, "trend"> {
  distanceKm?: number;
}

/**
 * Enseignes des stations : champ officiel si présent, sinon tags OSM
 * (brand/operator/name) reconnus via le catalogue d'enseignes.
 * `priorityIds` : identifiants interrogés EN PREMIER — typiquement la station
 * la moins chère (carte hero) et la station sélectionnée, choisies au prix
 * et pas à la distance. Chaque morceau de réponse s'affiche dès son arrivée
 * (jamais d'attente des 150 stations), donc les premiers logos tombent en
 * 2-3 s au lieu d'une dizaine de secondes.
 * Retourne un objet `{ [stationId]: { id, name, bg, fg, initials, logo } }`
 * (absent = inconnue ou encore en cours de recherche).
 */
export default function useBrands(
  stations: BrandStation[] | null | undefined,
  priorityIds: Array<string | null | undefined> = [],
): Record<string, BrandInfo> {
  const [osmTags, setOsmTags] = useState<Record<string, OsmTags>>({});

  const targets = useMemo<OsmStationRef[]>(() => {
    if (!stations?.length) return [];
    const byId = new Map(stations.map((s) => [s.id, s]));
    // La moins chère / la sélectionnée passent devant, même si elles sont loin.
    const ordered: BrandStation[] = [];
    const seen = new Set<string>();
    for (const id of priorityIds) {
      if (id == null || seen.has(id)) continue;
      const s = byId.get(id);
      if (s) {
        seen.add(id);
        ordered.push(s);
      }
    }
    const nearest = [...stations].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    for (const s of nearest) {
      if (ordered.length >= MAX_ENRICH) break;
      if (!seen.has(s.id)) {
        seen.add(s.id);
        ordered.push(s);
      }
    }
    return ordered.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon }));
  }, [stations, priorityIds]);

  const idsKey = useMemo(() => targets.map((t) => t.id).join(","), [targets]);

  useEffect(() => {
    if (!targets.length) return undefined;
    const controller = new AbortController();
    const cache = loadBrandCache();

    const fromCache: Record<string, OsmTags> = {};
    const missing: OsmStationRef[] = [];
    for (const t of targets) {
      const hit = cache.get(t.id);
      if (hit) fromCache[t.id] = { brand: hit.b ?? null, operator: hit.o ?? null, name: hit.n ?? null };
      else missing.push(t);
    }
    if (Object.keys(fromCache).length) {
      setOsmTags((prev) => ({ ...fromCache, ...prev }));
    }
    if (!missing.length) return undefined;

    (async () => {
      // Chaque morceau reçu est appliqué aussitôt (état + cache) : pas
      // d'attente du morceau le plus lent d'Overpass (~10 s avant).
      const onChunk = (local: Map<string, OsmTags>): void => {
        if (controller.signal.aborted || local.size === 0) return;
        const now = Date.now();
        for (const [id, tags] of local) {
          cache.set(id, { t: now, b: tags.brand, o: tags.operator, n: tags.name });
        }
        saveBrandCache(cache);
        setOsmTags((prev) => ({ ...prev, ...Object.fromEntries(local) }));
      };
      await fetchOsmTagsForStations(missing, controller.signal, onChunk);
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return useMemo(() => {
    if (!stations?.length) return {};
    const map: Record<string, BrandInfo> = {};
    for (const s of stations) {
      const direct = detectBrand(s.brand);
      if (direct) {
        map[s.id] = direct;
        continue;
      }
      const tags = osmTags[s.id];
      if (tags) {
        const brand = detectBrand(tags.brand, tags.operator, tags.name);
        if (brand) map[s.id] = brand;
      }
    }
    return map;
  }, [stations, osmTags]);
}
