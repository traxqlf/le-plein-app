import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FUEL, FUELS, fuelLabel } from "./lib/fuels.js";
import { formatAge, elideDe } from "./lib/format.js";
import { haversineKm } from "./lib/geo.js";
import { normalizeTheme, resolveTheme, nextTheme, THEME_LABELS, THEME_META_COLORS } from "./lib/theme.js";
import usePersistentState from "./hooks/usePersistentState.js";
import useLocation from "./hooks/useLocation.js";
import useStations from "./hooks/useStations.js";
import usePriceTrends from "./hooks/usePriceTrends.js";
import useBrands from "./hooks/useBrands.js";
import useInstallPrompt from "./hooks/useInstallPrompt.js";
import useMediaQuery from "./hooks/useMediaQuery.js";
import LocationBar from "./components/LocationBar.jsx";
import AccentPicker from "./components/AccentPicker.jsx";
import CalcSheet from "./components/CalcSheet.jsx";
import { FuelPicker, Segmented, Switch } from "./components/Controls.jsx";
import Hero from "./components/Hero.jsx";
import StationRow from "./components/StationRow.jsx";
import StationMap from "./components/StationMap.jsx";
import InstallBanner from "./components/InstallBanner.jsx";
import { Notice, Skeleton } from "./components/States.jsx";
import { IconList, IconMap, IconRefresh, IconMoon, IconSun, IconThemeAuto } from "./components/Icons.jsx";

const RADII = [2, 5, 10, 20];
const SORTS = ["price", "distance"];
const plural = (n, one, many) => (n > 1 ? many : one);

// Bloc carburants + rayon + tri, partagé entre l'en-tête fixe (ordinateur)
// et le flux défilant (mobile) : même état, jamais de divergence.
function FilterControls({ fuel, onFuel, radius, onRadius, sort, onSort }) {
  return (
    <>
      <FuelPicker value={fuel} onChange={onFuel} />
      <div className="filters">
        <Segmented
          label="Rayon de recherche"
          value={radius}
          onChange={onRadius}
          options={RADII.map((r) => ({ value: r, label: `${r} km` }))}
        />
        <Segmented
          label="Trier par"
          value={sort}
          onChange={onSort}
          options={[
            { value: "price", label: "Prix" },
            { value: "distance", label: "Distance" },
          ]}
        />
      </div>
    </>
  );
}

function sortRows(list, sort) {
  return [...list].sort((a, b) => {
    const aOk = a.offer.status === "available";
    const bOk = b.offer.status === "available";
    if (aOk !== bOk) return aOk ? -1 : 1; // les ruptures toujours en bas
    if (aOk && sort === "price") return a.offer.price - b.offer.price || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export default function App() {
  const { place, status: locStatus, error: locError, locate, pick } = useLocation();
  const [storedFuel, setFuel] = usePersistentState("leplein:fuel", DEFAULT_FUEL);
  const [storedRadius, setRadius] = usePersistentState("leplein:radius", 5);
  const [storedSort, setSort] = usePersistentState("leplein:sort", "price");
  const [hideShortage, setHideShortage] = usePersistentState("leplein:hide-shortage", true);
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null); // station survolée dans la liste -> surbrillance sur la carte
  const [calcOpen, setCalcOpen] = useState(false);
  const [storedTheme, setTheme] = usePersistentState("leplein:theme", "system");

  // Thème validé (une valeur périmée retombe sur "system").
  const themeMode = normalizeTheme(storedTheme);

  // Thème clair/sombre : le choix manuel gagne, sinon on suit l'appareil en direct.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = resolveTheme(themeMode, media.matches);
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", THEME_META_COLORS[resolved]);
    };
    apply();
    if (themeMode === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    return undefined;
  }, [themeMode]);

  // Valeurs mémorisées possiblement périmées : on les valide avant usage.
  const fuel = FUELS.some((f) => f.key === storedFuel) ? storedFuel : DEFAULT_FUEL;
  const radius = RADII.includes(storedRadius) ? storedRadius : 5;
  const sort = SORTS.includes(storedSort) ? storedSort : "price";

  const isDesktop = useMediaQuery("(min-width: 60rem)");
  const install = useInstallPrompt();
  const { stations, status, error, fetchedAt, reload } = useStations(place, radius);
  const trends = usePriceTrends(stations, fetchedAt);

  // Stations qui proposent le carburant choisi, avec distance exacte depuis la position.
  const rows = useMemo(() => {
    if (!place) return [];
    return stations
      .map((s) => ({
        ...s,
        distanceKm: haversineKm(place, s),
        offer: s.fuels[fuel],
        trend: trends[`${s.id}:${fuel}`] ?? null,
      }))
      .filter((s) => s.offer.status !== "absent" && s.distanceKm <= radius + 0.1);
  }, [stations, place, fuel, radius, trends]);

  const available = useMemo(() => rows.filter((s) => s.offer.status === "available"), [rows]);
  const shortageCount = rows.length - available.length;

  const cheapest = useMemo(
    () => available.reduce((best, s) => (!best || s.offer.price < best.offer.price ? s : best), null),
    [available],
  );

  const visible = useMemo(
    () => sortRows(hideShortage ? available : rows, sort),
    [hideShortage, available, rows, sort],
  );

  // La carte affiche TOUJOURS toutes les stations du rayon (ruptures grisées
  // incluses) : sinon, avec « Masquer les ruptures » activé (défaut), des
  // pastilles disparaissent de la carte et donnent l'impression qu'il manque
  // des stations. Seule la liste respecte l'interrupteur.
  const mapStations = useMemo(() => sortRows(rows, sort), [rows, sort]);

  const selected = mapStations.find((s) => s.id === selectedId) ?? null;

  // La moins chère (carte hero) et la sélectionnée sont toujours enrichies
  // en enseigne, même si elles sont loin (triées au prix, pas à la distance).
  const priorityBrandIds = useMemo(
    () => [cheapest?.id, selectedId].filter((id) => id != null),
    [cheapest?.id, selectedId],
  );
  const brands = useBrands(rows, priorityBrandIds);

  // Une sélection (carte ou liste) cale la station en haut de la liste.
  // INTERDICTION de scrollIntoView() : lui seul pouvait faire défiler la
  // page globale (vide noir). Ici, seul panel.scrollTop est modifié via
  // panel.scrollTo() : mathématiquement incapable de toucher window/body.
  // La marge d'arrêt vient du CSS (.hero / .row scroll-margin-top).
  useEffect(() => {
    if (!selectedId) return undefined;
    const panel = document.querySelector(".list-scroll");
    // Liste masquée (display: none) ou rien à défiler : aucun scroll.
    if (!panel || panel.clientHeight === 0) return undefined;
    if (panel.scrollHeight <= panel.clientHeight + 1) return undefined;
    // Cible : la grande carte bleue pour la moins chère, sinon la ligne.
    const el =
      cheapest && selectedId === cheapest.id
        ? document.getElementById("cheapest-hero")
        : document.getElementById(`station-${selectedId}`);
    if (!el) return undefined;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    // Position relative au panneau (rects viewport : insensible aux ancêtres
    // positionnés, contrairement à offsetTop). Seul le panneau défile.
    const marginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const panelRect = panel.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    panel.scrollTo({
      top: panel.scrollTop + (elRect.top - panelRect.top) - marginTop,
      behavior,
    });
    return undefined;
  }, [selectedId, view, hideShortage, cheapest?.id]);

  // PC : l'en-tête (lieu + carburants + filtres) est fixe, hors de
  // .list-scroll. La molette au-dessus ne fait donc rien nativement (aucun
  // ancêtre défilant) : on la redirige vers la liste. Les événements déjà
  // gérés en horizontal par FuelPicker n'arrivent jamais ici
  // (stopPropagation), et tout ce qui est dans .list-scroll garde son
  // comportement natif.
  useEffect(() => {
    if (!isDesktop) return undefined;
    const header = document.querySelector(".panel--list");
    if (!header) return undefined;
    const forward = (e) => {
      if (e.target instanceof Element) {
        if (e.target.closest(".list-scroll")) return;
        if (e.target.closest(".fuels")) return; // isolé : géré par FuelPicker, jamais la liste
      }
      if (e.deltaY === 0) return; // horizontal pur (trackpad) : natif, sinon on le tuerait
      const panel = header.querySelector(".list-scroll");
      if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return;
      const unit = e.deltaMode === 1 ? 16 : 1;
      panel.scrollTop += e.deltaY * unit;
      e.preventDefault();
    };
    header.addEventListener("wheel", forward, { passive: false });
    return () => header.removeEventListener("wheel", forward);
  }, [isDesktop]);

  const busy = status === "loading" || status === "refreshing";
  const age = formatAge(fetchedAt);
  const nextRadius = RADII.find((r) => r > radius);
  const ThemeIcon = themeMode === "dark" ? IconMoon : themeMode === "light" ? IconSun : IconThemeAuto;

  let content;
  if (!place) {
    content = (
      <Notice
        title="Où faites-vous le plein ?"
        actions={[{ label: "Autour de moi", primary: true, onClick: locate }]}
      >
        Prix officiels et ruptures de stock des stations autour de vous, actualisés toutes les 10 minutes.
        Autorisez la localisation, ou cherchez une ville.
      </Notice>
    );
  } else if (status === "loading" && rows.length === 0) {
    content = <Skeleton />;
  } else if (status === "error" && stations.length === 0) {
    content = (
      <Notice
        tone="error"
        title="Prix indisponibles"
        actions={[{ label: "Réessayer", primary: true, onClick: reload }]}
      >
        {error} Vérifiez votre connexion puis réessayez.
      </Notice>
    );
  } else if (rows.length === 0) {
    content = (
      <Notice
        title={`Aucune station ${fuelLabel(fuel)} dans ${radius} km`}
        actions={nextRadius ? [{ label: `Passer à ${nextRadius} km`, primary: true, onClick: () => setRadius(nextRadius) }] : []}
      >
        Aucune station de cette zone ne propose ce carburant. Élargissez le rayon ou choisissez un autre carburant.
      </Notice>
    );
  } else {
    content = (
      <>
        {status === "error" && (
          <p className="banner" role="status">
            Actualisation impossible. Les prix affichés datent de {age ?? "quelques minutes"}.
          </p>
        )}

        {cheapest && <Hero station={cheapest} fuel={fuel} radius={radius} brand={brands[cheapest.id]} onSelect={setSelectedId} />}

        <div className="summary">
          <p className="summary__text">
            <strong>{available.length}</strong> {plural(available.length, "station disponible", "stations disponibles")}
            {shortageCount > 0 && (
              <>
                , <strong>{shortageCount}</strong> en rupture
              </>
            )}
          </p>
          {shortageCount > 0 && (
            <Switch checked={hideShortage} onChange={setHideShortage}>
              Masquer les ruptures
            </Switch>
          )}
        </div>

        {visible.length === 0 ? (
          <Notice
            title="Toutes les stations sont en rupture"
            actions={[{ label: "Afficher les ruptures", primary: true, onClick: () => setHideShortage(false) }]}
          >
            Aucune station de la zone n'a de {fuelLabel(fuel)} disponible pour le moment.
          </Notice>
        ) : (
          <ul className="list">
            {visible.map((s) => (
              <StationRow
                key={s.id}
                domId={`station-${s.id}`}
                station={s}
                fuel={fuel}
                cheapest={cheapest?.offer.price}
                brand={brands[s.id]}
                expanded={s.id === selectedId}
                onToggle={() => setSelectedId((id) => (id === s.id ? null : s.id))}
                onHover={setHoverId}
              />
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className={`app view-${view}`}>
      <header className="topbar">
        <div className="topbar__row">
          <h1 className="brand">Le Plein</h1>
          <div className="topbar__actions">
            <AccentPicker />
            <button
              type="button"
              className="topbar__theme"
              onClick={() => setTheme((current) => nextTheme(current))}
              aria-label={`Thème ${THEME_LABELS[themeMode]} — toucher pour changer`}
              title={`Thème : ${THEME_LABELS[themeMode]}`}
            >
              <ThemeIcon />
            </button>
            {place && (
              <button
                type="button"
                className="topbar__refresh"
                onClick={reload}
                disabled={busy}
                aria-label={busy ? "Actualisation des prix…" : age ? `Actualiser les prix (${age})` : "Actualiser les prix"}
              >
                <IconRefresh className={busy ? "spin" : undefined} />
                <span>{busy ? "Actualisation…" : age ? `Actualisé ${age}` : "Actualiser"}</span>
              </button>
            )}
          </div>
        </div>
        <LocationBar
          locating={locStatus === "locating"}
          onLocate={locate}
          onPick={pick}
          onCalc={() => setCalcOpen((o) => !o)}
          calcOpen={calcOpen}
        />
        {locError && (
          <p className="topbar__error" role="alert">
            {locError}
          </p>
        )}
      </header>

      <main className="layout">
        <section className="panel panel--list" aria-label="Stations-service">
          {/* Ordinateur : localisation fixe entre recherche et filtres,
              exactement comme sur mobile (centrée verticalement). */}
          {place && (
            <p className="scroll-place only-desktop">Autour {place.source !== "gps" && elideDe(place.label) ? "d'" : "de "}<strong>{place.source === "gps" ? "vous" : place.label}</strong></p>
          )}
          {/* Ordinateur : en-tête fixe hors scroll (inchangé). */}
          <div className="only-desktop">
            <FilterControls
              fuel={fuel}
              onFuel={setFuel}
              radius={radius}
              onRadius={setRadius}
              sort={sort}
              onSort={setSort}
            />
          </div>

          <div className="list-scroll">
            <InstallBanner
              canInstall={install.canInstall}
              showIOSHint={install.showIOSHint}
              onInstall={install.install}
              onDismiss={install.dismiss}
            />

            {/* Localisation en tête du flux défilant (hors header fixe) :
                elle glisse et disparaît vers le haut au scroll, juste
                au-dessus des filtres de carburants. */}
            {place && (
              <p className="scroll-place only-mobile">Autour {place.source !== "gps" && elideDe(place.label) ? "d'" : "de "}<strong>{place.source === "gps" ? "vous" : place.label}</strong></p>
            )}

            {/* Mobile : filtres dans le flux, juste sous la recherche — aucun
                sticky/fixed, ils disparaissent au défilement (100 % aux cartes). */}
            <div className="only-mobile">
              <FilterControls
                fuel={fuel}
                onFuel={setFuel}
                radius={radius}
                onRadius={setRadius}
                sort={sort}
                onSort={setSort}
              />
            </div>

            {content}

            <footer className="credits">
              Prix : prix-carburants.gouv.fr (Licence Ouverte 2.0), relevés déclarés par les stations. Carte :
              contributeurs OpenStreetMap.
            </footer>
          </div>
        </section>

        <section className="panel panel--map" aria-label="Carte des stations">
          <div className="map-wrap">
            {place ? (
              <>
                <StationMap
                  place={place}
                  radiusKm={radius}
                  stations={mapStations}
                  brands={brands}
                  cheapestId={cheapest?.id}
                  selectedId={selected?.id}
                  hoverId={hoverId}
                  onSelect={setSelectedId}
                  active={view === "map" || isDesktop}
                />
                {/* Rayon modifiable sans revenir à la liste (synchronisé). */}
                <div className="map-radius">
                  <Segmented
                    label="Rayon de recherche"
                    value={radius}
                    onChange={setRadius}
                    options={RADII.map((r) => ({ value: r, label: `${r} km` }))}
                  />
                </div>
              </>
            ) : (
              <p className="map-empty">La carte s'affichera dès que votre position sera connue.</p>
            )}
            {selected && (
              <div className="map-sheet">
                <StationRow
                  variant="sheet"
                  station={selected}
                  fuel={fuel}
                  cheapest={cheapest?.offer.price}
                  brand={brands[selected.id]}
                  onDetails={() => {
                    // Une rupture sélectionnée sur la carte est masquée de la
                    // liste quand l'interrupteur est actif : on la réaffiche
                    // pour que « Détails » scrolle vraiment jusqu'à sa fiche.
                    if (hideShortage && selected.offer.status !== "available") setHideShortage(false);
                    setView("list");
                  }}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      <nav className="tabbar" aria-label="Affichage">
        <button type="button" className="tabbar__btn" aria-pressed={view === "list"} onClick={() => setView("list")}>
          <IconList />
          Liste
        </button>
        <button type="button" className="tabbar__btn" aria-pressed={view === "map"} onClick={() => setView("map")}>
          <IconMap />
          Carte
        </button>
      </nav>

      <p className="sr-only" role="status" aria-live="polite">
        {status === "ready" ? `${visible.length} ${plural(visible.length, "station affichée", "stations affichées")}` : ""}
      </p>

      {calcOpen && (
        <CalcSheet
          price={cheapest?.offer.price ?? null}
          fuelName={fuelLabel(fuel)}
          contextLabel={
            cheapest
              ? `${brands[cheapest.id]?.name ? `${brands[cheapest.id].name} · ` : ""}${cheapest.address}, ${cheapest.city}`
              : null
          }
          onClose={() => setCalcOpen(false)}
        />
      )}
    </div>
  );
}
