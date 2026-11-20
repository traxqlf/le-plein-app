import { useMemo, useState } from "react";
import usePersistentState from "../hooks/usePersistentState.ts";
import { navUrls, NAV_APP_IDS, type NavAppId } from "../lib/geo.ts";
import { IconChevron, IconRoute } from "./Icons.tsx";
import NavSheet from "./NavSheet.tsx";

/**
 * Bouton « Y aller » : ouvre le choix du GPS (Google Maps / Waze / Apple Plans).
 * Si un choix est mémorisé, le bouton mène directement à l'appli et un chevron
 * permet de rouvrir le menu pour en changer.
 */
export default function GoButton({
  station,
}: {
  station: { lat: number; lon: number };
}): React.JSX.Element {
  const [storedApp, setStoredApp] = usePersistentState<string | null>("leplein:nav-app", null);
  const [open, setOpen] = useState(false);

  const urls = useMemo(() => navUrls(station.lat, station.lon), [station.lat, station.lon]);
  const savedId: NavAppId | null =
    storedApp !== null && (NAV_APP_IDS as readonly string[]).includes(storedApp)
      ? (storedApp as NavAppId)
      : null;
  const direct = savedId ? urls.find((u) => u.id === savedId) : null;

  return (
    <span className="go">
      {direct ? (
        <a
          className="btn btn--primary go__main"
          href={direct.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconRoute />
          Y aller
        </a>
      ) : (
        <button type="button" className="btn btn--primary go__main" onClick={() => setOpen(true)}>
          <IconRoute />
          Y aller
        </button>
      )}
      {savedId && (
        <button
          type="button"
          className="btn btn--icon go__switcher"
          onClick={() => setOpen(true)}
          aria-label="Choisir une autre application GPS"
          title="Choisir une autre application GPS"
        >
          <IconChevron />
        </button>
      )}
      {open && (
        <NavSheet urls={urls} savedId={savedId} onSave={setStoredApp} onClose={() => setOpen(false)} />
      )}
    </span>
  );
}
