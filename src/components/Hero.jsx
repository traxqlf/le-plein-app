import { fuelLabel } from "../lib/fuels.js";
import { formatDistance } from "../lib/geo.js";
import PriceSign from "./PriceSign.jsx";
import BrandBadge from "./BrandBadge.jsx";
import GoButton from "./GoButton.jsx";

/** La station la moins chère de la zone, mise en avant en grand format. */
export default function Hero({ station, fuel, radius, brand, onSelect }) {
  return (
    <section className="hero" id="cheapest-hero" aria-labelledby="hero-title">
      <h2 id="hero-title" className="hero__title">
        Le moins cher dans {radius} km
      </h2>
      <div className="hero__board">
        <div className="hero__info">
          <BrandBadge brand={brand} size="lg" fallback eager />
          <p className="hero__address">{station.address}</p>
          <p className="hero__city">
            {station.postcode} {station.city}
          </p>
          <p className="hero__distance">À {formatDistance(station.distanceKm)}</p>
          <div className="hero__actions">
            <GoButton station={station} />
            <button type="button" className="btn" onClick={() => onSelect(station.id)}>
              Voir la fiche
            </button>
          </div>
        </div>
        <PriceSign price={station.offer.price} size="xl" label={fuelLabel(fuel)} fuel={fuel} trend={station.trend} />
      </div>
    </section>
  );
}
