import type { FuelOffer, Station } from "./api.ts";
import type { PriceTrend } from "./history.ts";

/**
 * Station affichée : relevé officiel + distance depuis la position,
 * offre du carburant choisi et tendance locale du prix.
 */
export interface EnrichedStation extends Omit<Station, "trend"> {
  distanceKm: number;
  offer: FuelOffer;
  trend: PriceTrend | null;
}
