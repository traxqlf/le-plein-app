import { splitPrice, formatPriceFull } from "../lib/format.js";
import { fuelColors } from "../lib/fuels.js";

/**
 * Flèche + mot décrivant une tendance { direction, text? }, ou null.
 * Partagé avec la liste des stations, qui affiche la tendance en petit dans
 * la ligne de statut plutôt que dans le bloc prix.
 */
export function describeTrend(trend) {
  if (!trend) return null;
  if (trend.direction === "up") return { arrow: "↗", word: "en hausse" };
  if (trend.direction === "down") return { arrow: "↘", word: "en baisse" };
  if (trend.direction === "flat") return { arrow: "→", word: "stable" };
  return null;
}

/**
 * Prix au litre en typographie SF (chiffres tabulaires, dernier chiffre en
 * exposant). size : "sm" (liste) | "xl" (mise en avant).
 * muted : carburant en rupture (chiffres barrés, gris).
 * fuel : clé du carburant (ex. "gazole") pour teinter le badge à sa couleur
 * officielle plutôt qu'au thème.
 * trend : { direction: "up" | "down" | "flat", text?: string } — pastille
 * d'évolution du prix (mise en avant uniquement ; en liste, la tendance
 * s'affiche en petit dans la ligne de statut, voir StationRow).
 */
export default function PriceSign({ price, size = "sm", muted = false, label, fuel, trend }) {
  if (price == null) {
    return (
      <span className={`sign sign--${size} is-muted`} role="img" aria-label="Prix inconnu">
        <span className="sign__digits" aria-hidden="true">–</span>
      </span>
    );
  }
  const { main, sup } = splitPrice(price);
  const colors = fuel ? fuelColors(fuel) : null;
  const trendInfo = describeTrend(trend);
  return (
    <span
      className={`sign sign--${size}${muted ? " is-muted" : ""}`}
      style={colors ? { "--fuel": colors.bg, "--fuel-ink": colors.fg } : undefined}
      role="img"
      aria-label={`${label ? `${label} : ` : ""}${formatPriceFull(price)} le litre${trendInfo ? `, ${trendInfo.word}${trend?.text ? ` (${trend.text})` : ""}` : ""}`}
    >
      {label && (
        <span className="sign__label" aria-hidden="true">
          {label}
        </span>
      )}
      <span className="sign__digits" aria-hidden="true">
        {main}
        <sup className="sign__sup">{sup}</sup>
      </span>
      {trendInfo && (
        <span className={`trend trend--${trend.direction}`} aria-hidden="true">
          <span className="trend__arrow">{trendInfo.arrow}</span>
          {trend.text && <span className="trend__text">{trend.text}</span>}
        </span>
      )}
    </span>
  );
}
