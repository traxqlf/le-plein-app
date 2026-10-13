import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON } from "../lib/storage.js";

const KEY = "leplein:place";

/**
 * Position de référence : GPS ou commune recherchée.
 * La dernière position est mémorisée (sur iOS, une PWA redemande souvent l'autorisation GPS).
 */
export default function useLocation() {
  const [place, setPlace] = useState(() => readJSON(KEY, null)); // { lat, lon, label, source }
  const [status, setStatus] = useState("idle"); // idle | locating | error
  const [error, setError] = useState(null);

  const savePlace = useCallback((next) => {
    setPlace(next);
    writeJSON(KEY, next);
    setStatus("idle");
    setError(null);
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("La géolocalisation n'est pas disponible sur cet appareil. Cherchez une ville.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        savePlace({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Ma position", source: "gps" }),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée. Autorisez-la dans les réglages du navigateur ou cherchez une ville."
            : "Position introuvable. Réessayez ou cherchez une ville.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [savePlace]);

  const pick = useCallback((p) => savePlace({ lat: p.lat, lon: p.lon, label: p.label, source: "search" }), [savePlace]);

  // Si l'autorisation GPS est déjà accordée, on se relocalise sans clic.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (!cancelled && result.state === "granted" && (!place || place.source === "gps")) locate();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { place, status, error, locate, pick };
}
