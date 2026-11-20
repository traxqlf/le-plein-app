/** Point géographique en degrés décimaux. */
export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6371; // rayon de la Terre en km
const rad = (d: number): number => (d * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 10) * 100} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}

export interface NavApp {
  id: string;
  name: string;
  url: string;
}

/** Applications de navigation : deep links universels (ouvrent l'appli si installée). */
export function navUrls(lat: number, lon: number): NavApp[] {
  const dest = `${lat},${lon}`;
  return [
    { id: "google", name: "Google Maps", url: `https://www.google.com/maps/dir/?api=1&destination=${dest}` },
    { id: "waze", name: "Waze", url: `https://waze.com/ul?ll=${dest}&navigate=yes` },
    { id: "apple", name: "Apple Plans", url: `https://maps.apple.com/?daddr=${dest}&dirflg=d` },
  ];
}

export const NAV_APP_IDS = ["google", "waze", "apple"] as const;

export type NavAppId = (typeof NAV_APP_IDS)[number];
