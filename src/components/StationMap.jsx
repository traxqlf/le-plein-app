import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { splitPrice } from "../lib/format.js";
import useDarkMode from "../hooks/useDarkMode.js";
import useMediaQuery from "../hooks/useMediaQuery.js";

// Un seul fournisseur : OpenStreetMap, style Leaflet d'origine en clair
// comme en sombre. En sombre, les mêmes tuiles sont passées en noir via
// `.map--dark` (voir styles.css) : gratuit, sans clé, sans compte, et
// strictement le même niveau de détail qu'en clair (mêmes tuiles).
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// Point bleu de la position de l'utilisateur (toujours au-dessus des pastilles de prix).
const hereIcon = L.divIcon({
  className: "here-wrap",
  html: '<span class="here"></span>',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function pinIcon(s, { selected, best, hovered, brand }) {
  const ok = s.offer.status === "available";
  const { main, sup } = ok ? splitPrice(s.offer.price) : { main: "–", sup: "" };
  const branded = ok && !best && brand;
  // La station la moins chère arbore une flamme 🔥 devant son prix
  // (à la place des initiales d'enseigne).
  const fire = best && ok;
  const cls = ["pin", !ok && "pin--off", best && "pin--best", branded && "pin--brand", hovered && "pin--hover", selected && "pin--selected"]
    .filter(Boolean)
    .join(" ");
  // Couleurs issues de notre catalogue interne : pas de risque d'injection.
  const style = branded ? ` style="--pin-bg:${brand.bg};--pin-fg:${brand.fg}"` : "";
  const logo = fire ? `<span class="pin__fire" aria-hidden="true">🔥</span>` : "";
  return L.divIcon({
    className: "pin-wrap",
    html: `<span class="${cls}"${style}>${logo}${main}${sup ? `<sup>${sup}</sup>` : ""}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Cadre la carte sur le rayon choisi, et recalcule sa taille quand elle redevient visible. */
function Framing({ center, radiusKm, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return undefined;
    map.invalidateSize();
    map.fitBounds(L.latLng(center.lat, center.lon).toBounds(radiusKm * 2000), { animate: false });
  }, [map, center.lat, center.lon, radiusKm, active]);
  return null;
}

function PanToSelected({ station }) {
  const map = useMap();
  useEffect(() => {
    if (station) map.panTo([station.lat, station.lon], { animate: true });
  }, [map, station]);
  return null;
}

export default function StationMap({ place, radiusKm, stations, brands, cheapestId, selectedId, hoverId, onSelect, active }) {
  // Fond de carte assorti au thème, bascule instantanée au toggle.
  // Clair et sombre : mêmes tuiles OSM style Leaflet. En sombre, `.map--dark`
  // les passe en noir (pastilles de prix non touchées).
  const dark = useDarkMode();
  // PC : zoom en haut à gauche comme avant ; mobile : en bas à droite pour
  // libérer le haut au bandeau de rayon.
  const zoomPosition = useMediaQuery("(min-width: 60rem)") ? "topleft" : "bottomright";
  // Pas de pastille grise « – » sur la carte : seules les stations qui
  // proposent le carburant filtré avec un prix valide ont un marqueur.
  // (La sélection / fiche `selected` reste cherchée dans toutes les stations
  // pour que la fiche d'une rupture sélectionnée depuis la liste s'affiche.)
  const pins = useMemo(
    () => stations.filter((s) => s.offer?.status === "available" && Number.isFinite(s.offer?.price)),
    [stations],
  );
  const icons = useMemo(
    () =>
      pins.map((s) => pinIcon(s, { selected: s.id === selectedId, best: s.id === cheapestId, hovered: s.id === hoverId, brand: brands?.[s.id] })),
    [pins, brands, selectedId, cheapestId, hoverId],
  );
  const selected = stations.find((s) => s.id === selectedId) ?? null;

  return (
    <MapContainer
      className={`map${dark ? " map--dark" : ""}`}
      center={[place.lat, place.lon]}
      zoom={13}
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position={zoomPosition} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={OSM_URL}
        maxZoom={19}
      />
      <Circle
        center={[place.lat, place.lon]}
        radius={radiusKm * 1000}
        pathOptions={
          dark
            ? { color: "#5ea0ff", weight: 1.5, dashArray: "6 6", fillOpacity: 0.06 }
            : { color: "#12294a", weight: 1.5, dashArray: "6 6", fillOpacity: 0.04 }
        }
      />
      <Marker
        position={[place.lat, place.lon]}
        icon={hereIcon}
        interactive={false}
        keyboard={false}
        zIndexOffset={2000}
      />
      {pins.map((s, i) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lon]}
          icon={icons[i]}
          title={`${s.address}, ${s.city}`}
          keyboard={false}
          zIndexOffset={s.id === selectedId || s.id === hoverId ? 1500 : s.id === cheapestId ? 500 : 100}
          eventHandlers={{ click: () => onSelect(s.id) }}
        />
      ))}
      <Framing center={place} radiusKm={radiusKm} active={active} />
      <PanToSelected station={selected} />
    </MapContainer>
  );
}
