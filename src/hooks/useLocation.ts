import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON } from "../lib/storage.ts";

const KEY = "leplein:place";

export type PlaceSource = "gps" | "search";

export interface UserPlace {
  lat: number;
  lon: number;
  label: string;
  source: PlaceSource;
}

export type LocationStatus = "idle" | "locating" | "error";

export interface PickedPlace {
  lat: number;
  lon: number;
  label: string;
}

/**
 * Position de référence : GPS ou commune recherchée.
 * La dernière position est mémorisée (sur iOS, une PWA redemande souvent l'autorisation GPS).
 */
export default function useLocation(): {
  place: UserPlace | null;
  status: LocationStatus;
  error: string | null;
  locate: () => void;
  pick: (p: PickedPlace) => void;
} {
  const [place, setPlace] = useState<UserPlace | null>(() => readJSON<UserPlace | null>(KEY, null)); // { lat, lon, label, source }
  const [status, setStatus] = useState<LocationStatus>("idle"); // idle | locating | error
  const [error, setError] = useState<string | null>(null);

  const savePlace = useCallback((next: UserPlace) => {
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

  const pick = useCallback(
    (p: PickedPlace) => savePlace({ lat: p.lat, lon: p.lon, label: p.label, source: "search" }),
    [savePlace],
  );

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
