import { useEffect, useMemo, useRef, useState } from "react";
import { FUELS } from "../lib/fuels.js";
import { loadHistory, saveHistory, recordPrices, getTrend } from "../lib/history.js";

/**
 * Tendances de prix par station et par carburant : `{ "id:carburant": trend }`.
 * Chaque fetch réussi (repéré par `fetchedAt`) est enregistré une seule fois ;
 * les tendances se recalculent dès que l'historique s'enrichit.
 */
export default function usePriceTrends(stations, fetchedAt) {
  const [history, setHistory] = useState(() => loadHistory());
  const recordedRef = useRef(null);

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
    const trends = {};
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
