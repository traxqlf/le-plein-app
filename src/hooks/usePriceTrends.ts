import { useEffect, useMemo, useRef, useState } from "react";
import { FUELS } from "../lib/fuels.ts";
import {
  loadHistory,
  saveHistory,
  recordPrices,
  getTrend,
  type PriceHistory,
  type PriceTrend,
  type PricedStation,
} from "../lib/history.ts";

/**
 * Tendances de prix par station et par carburant : `{ "id:carburant": trend }`.
 * Chaque fetch réussi (repéré par `fetchedAt`) est enregistré une seule fois ;
 * les tendances se recalculent dès que l'historique s'enrichit.
 */
export default function usePriceTrends(
  stations: PricedStation[] | null | undefined,
  fetchedAt: number | null,
): Record<string, PriceTrend | null> {
  const [history, setHistory] = useState<PriceHistory>(() => loadHistory());
  const recordedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!fetchedAt || !stations?.length || recordedRef.current === fetchedAt) return;
    recordedRef.current = fetchedAt;
    setHistory((prev) => {
      const next = recordPrices(prev, stations, fetchedAt);
      saveHistory(next);
      return next;
    });
  }, [fetchedAt, stations]);

  return useMemo(() => {
    const trends: Record<string, PriceTrend | null> = {};
    if (!stations?.length) return trends;
    const now = Date.now();
    for (const s of stations) {
      for (const { key } of FUELS) {
        trends[`${s.id}:${key}`] = getTrend(history, s.id, key, now);
      }
    }
    return trends;
  }, [stations, history]);
}
