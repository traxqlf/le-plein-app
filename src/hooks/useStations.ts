import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStations, type Station } from "../lib/api.ts";

const REFRESH_MS = 10 * 60 * 1000; // le flux officiel est mis à jour toutes les 10 minutes
const STALE_MS = 5 * 60 * 1000;

export type StationsStatus = "idle" | "loading" | "refreshing" | "ready" | "error";

interface StationsState {
  key: string | null;
  stations: Station[];
  status: StationsStatus;
  error: string | null;
  fetchedAt: number | null;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Charge les stations autour de `place` et les rafraîchit toutes les 10 min / au retour sur l'appli. */
export default function useStations(
  place: { lat: number; lon: number } | null,
  radiusKm: number,
): {
  stations: Station[];
  status: StationsStatus;
  error: string | null;
  fetchedAt: number | null;
  reload: () => void;
} {
  const [state, setState] = useState<StationsState>({
    key: null,
    stations: [],
    status: "idle",
    error: null,
    fetchedAt: null,
  });
  const [tick, setTick] = useState(0);
  const fetchedAtRef = useRef(0);

  const lat = place ? round3(place.lat) : null;
  const lon = place ? round3(place.lon) : null;
  const key = lat === null ? null : `${lat},${lon}`;

  useEffect(() => {
    if (key === null || lat === null || lon === null) return undefined;
    const controller = new AbortController();
    setState((s) => ({
      ...s,
      status: s.key === key && s.stations.length ? "refreshing" : "loading",
      error: null,
    }));

    fetchStations({ lat, lon, radiusKm, signal: controller.signal })
      .then((stations) => {
        fetchedAtRef.current = Date.now();
        setState({ key, stations, status: "ready", error: null, fetchedAt: fetchedAtRef.current });
      })
      .catch((err: unknown) => {
        const name =
          typeof err === "object" && err !== null
            ? (err as { name?: unknown }).name
            : undefined;
        if (name === "AbortError") return;
        setState((s) => ({
          ...s,
          key,
          status: "error",
          error:
            err instanceof TypeError
              ? "Pas de connexion au service des prix."
              : err instanceof Error
                ? err.message
                : "Erreur inconnue.",
        }));
      });

    return () => controller.abort();
  }, [key, lat, lon, radiusKm, tick]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    const onVisible = (): void => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAtRef.current > STALE_MS) {
        setTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // Les stations d'une ancienne position ne doivent jamais s'afficher pour la nouvelle.
  const sameSpot = state.key === key;
  return {
    stations: sameSpot ? state.stations : [],
    status: key === null ? "idle" : sameSpot ? state.status : "loading",
    error: sameSpot ? state.error : null,
    fetchedAt: sameSpot ? state.fetchedAt : null,
    reload,
  };
}
