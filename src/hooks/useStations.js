import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStations } from "../lib/api.js";

const REFRESH_MS = 10 * 60 * 1000; // le flux officiel est mis à jour toutes les 10 minutes
const STALE_MS = 5 * 60 * 1000;

const round3 = (n) => Math.round(n * 1000) / 1000;

/** Charge les stations autour de `place` et les rafraîchit toutes les 10 min / au retour sur l'appli. */
export default function useStations(place, radiusKm) {
  const [state, setState] = useState({ key: null, stations: [], status: "idle", error: null, fetchedAt: null });
  const [tick, setTick] = useState(0);
  const fetchedAtRef = useRef(0);

  const lat = place ? round3(place.lat) : null;
  const lon = place ? round3(place.lon) : null;
  const key = lat === null ? null : `${lat},${lon}`;

  useEffect(() => {
    if (key === null) return undefined;
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
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState((s) => ({
          ...s,
          key,
          status: "error",
          error: err instanceof TypeError ? "Pas de connexion au service des prix." : err.message,
        }));
      });

    return () => controller.abort();
  }, [key, lat, lon, radiusKm, tick]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    const onVisible = () => {
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
