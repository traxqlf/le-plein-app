import { FUELS, STATUS_LABEL, fuelLabel } from "../lib/fuels.ts";
import { formatAge, formatDelta, formatPriceFull, isStale } from "../lib/format.ts";
import { formatDistance } from "../lib/geo.ts";
import { parseDecimalInput, formatLiters, formatEuros, costForLiters } from "../lib/calc.ts";
import type { BrandInfo } from "../lib/brands.ts";
import type { EnrichedStation } from "../lib/station.ts";
import usePersistentState from "../hooks/usePersistentState.ts";
import PriceSign, { describeTrend } from "./PriceSign.tsx";
import BrandBadge from "./BrandBadge.tsx";
import FuelCalculator from "./FuelCalculator.tsx";
import GoButton from "./GoButton.tsx";
import { IconClose } from "./Icons.tsx";

function Summary({
  s,
  fuel,
  ok,
  delta,
  brand,
}: {
  s: EnrichedStation;
  fuel: string;
  ok: boolean;
  delta: string | null;
  brand?: BrandInfo | null;
}): React.JSX.Element {
  const offer = s.offer;
  // Tendance discrète dans la ligne de statut : le bloc prix reste compact
  // (sinon la pastille élargit la colonne de gauche et décale tout le texte).
  const trend = describeTrend(s.trend);
  const stationTrend = s.trend;
  return (
    <>
      <PriceSign price={offer.price} muted={!ok} fuel={fuel} />
      <span className="row__body">
        <BrandBadge brand={brand} />
        <span className="row__address">{s.address}</span>
        <span className="row__city">
          {s.postcode} {s.city}
        </span>
        <span className="row__status">
          <span className={`status status--${offer.status}`}>
            <span className="status__dot" aria-hidden="true" />
            {STATUS_LABEL[offer.status]}
          </span>
          {delta && <span className="row__delta">{delta}</span>}
          {trend && stationTrend && (
            <span className={`row__trend row__trend--${stationTrend.direction}`}>
              {trend.arrow} {stationTrend.text ?? trend.word}
            </span>
          )}
        </span>
      </span>
      <span className="row__distance">{formatDistance(s.distanceKm)}</span>
    </>
  );
}

/**
 * Une station pour le carburant choisi.
 * `cheapest` = prix le plus bas de la zone (pour afficher l'écart).
 * variant "sheet" : fiche compacte affichée sur la carte (Y aller / Détails / Fermer).
 */
export default function StationRow({
  station: s,
  fuel,
  cheapest,
  brand,
  expanded,
  onToggle,
  onHover,
  domId,
  variant = "list",
  onDetails,
  onClose,
}: {
  station: EnrichedStation;
  fuel: string;
  cheapest?: number | null;
  brand?: BrandInfo | null;
  expanded?: boolean;
  onToggle?: () => void;
  onHover?: (id: string | null) => void;
  domId?: string;
  variant?: "list" | "sheet";
  onDetails?: () => void;
  onClose?: () => void;
}): React.JSX.Element {
  const offer = s.offer;
  const ok = offer.status === "available";
  const age = formatAge(offer.updatedAt);
  const stale = offer.updatedAt && isStale(offer.updatedAt);

  // Profil véhicule partagé avec le calculateur : l'estimation du plein
  // s'affiche instantanément dès l'ouverture de la fiche (valeur mémorisée).
  const [tank, setTank] = usePersistentState("leplein:tank-liters", "");
  const tankLiters = parseDecimalInput(tank);
  const tankCost =
    tankLiters != null && tankLiters > 0 && offer.price != null
      ? costForLiters(tankLiters, offer.price)
      : null;

  let delta: string | null = null;
  if (ok && offer.price != null && cheapest != null) {
    delta = offer.price - cheapest < 0.0005 ? "Le moins cher" : formatDelta(offer.price - cheapest);
  }

  if (variant === "sheet") {
    return (
      <div>
        <div className="row__main row__main--static">
          <Summary s={s} fuel={fuel} ok={ok} delta={delta} brand={brand} />
        </div>
        <div className="sheet__actions">
          <GoButton station={s} />
          <button type="button" className="btn" onClick={onDetails}>
            Détails
          </button>
          <button type="button" className="btn btn--icon sheet__close" onClick={onClose} aria-label="Fermer la fiche">
            <IconClose />
          </button>
        </div>
      </div>
    );
  }

  return (
    <li
      id={domId}
      className={`row${expanded ? " is-open" : ""}`}
      onMouseEnter={() => onHover?.(s.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <button
        type="button"
        className="row__main"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <Summary s={s} fuel={fuel} ok={ok} delta={delta} brand={brand} />
      </button>

      {expanded && (
        <div className="row__more">
          <ul className="tags">
            {s.highway && <li className="tag">Autoroute</li>}
            {s.open24 && <li className="tag">Automate 24 h/24</li>}
            {stale && <li className="tag tag--warn">Prix non mis à jour depuis plus de 7 jours</li>}
          </ul>

          <table className="fueltable">
            <caption className="sr-only">Carburants proposés par cette station</caption>
            <thead>
              <tr>
                <th scope="col">Carburant</th>
                <th scope="col">Prix</th>
                <th scope="col">Disponibilité</th>
              </tr>
            </thead>
            <tbody>
              {FUELS.filter((f) => s.fuels[f.key].status !== "absent").map((f) => {
                const o = s.fuels[f.key];
                return (
                  <tr key={f.key} className={f.key === fuel ? "is-current" : undefined}>
                    <th scope="row">{f.label}</th>
                    <td>{o.price != null ? formatPriceFull(o.price) : "–"}</td>
                    <td>
                      <span className={`status status--${o.status}`}>
                        <span className="status__dot" aria-hidden="true" />
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="row__updated">
            {age ? `${fuelLabel(fuel)} : prix relevé ${age}.` : "Date de relevé inconnue."}
          </p>

          {s.services.length > 0 && (
            <p className="row__services">{s.services.slice(0, 6).join(", ")}</p>
          )}

          {tankCost != null && tankLiters != null && (
            <p className="tank-estimate" role="status">
              Plein (~{formatLiters(tankLiters)} L) : <strong>{formatEuros(tankCost)}&nbsp;€</strong>
            </p>
          )}

          {offer.price != null && (
            <FuelCalculator
              price={offer.price}
              fuelName={fuelLabel(fuel)}
              tank={tank}
              onTankChange={setTank}
            />
          )}

          <GoButton station={s} />
        </div>
      )}
    </li>
  );
}
