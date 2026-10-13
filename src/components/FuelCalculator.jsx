import { useState } from "react";
import usePersistentState from "../hooks/usePersistentState.js";
import {
  parseDecimalInput,
  formatLiters,
  formatEuros,
  costForLiters,
  litersForCost,
} from "../lib/calc.js";
import { formatPriceFull } from "../lib/format.js";

/**
 * Calculateur de plein pour UNE station et UN carburant : les deux champs
 * (litres / montant) sont synchronisés dans les deux sens au prix du litre
 * de la station.
 * Le volume du réservoir peut être piloté de l'extérieur (`tank` /
 * `onTankChange`, profil partagé de la fiche) ou mémorisé en interne :
 * même clé localStorage dans les deux cas, donc toujours pré-rempli.
 * `idPrefix` distingue les instances (fiche station / en-tête / modale).
 */
export default function FuelCalculator({ price, fuelName, idPrefix = "calc", tank: controlledTank, onTankChange }) {
  const [liters, setLiters] = useState("");
  const [amount, setAmount] = useState("");
  const [internalTank, setInternalTank] = usePersistentState("leplein:tank-liters", "");
  const tank = controlledTank ?? internalTank;
  const setTank = onTankChange ?? setInternalTank;

  const onLiters = (value) => {
    setLiters(value);
    const litersValue = parseDecimalInput(value);
    setAmount(litersValue == null ? "" : formatEuros(costForLiters(litersValue, price)));
  };

  const onAmount = (value) => {
    setAmount(value);
    const amountValue = parseDecimalInput(value);
    const litersValue = amountValue == null ? null : litersForCost(amountValue, price);
    setLiters(litersValue == null ? "" : formatLiters(litersValue));
  };

  const tankLiters = parseDecimalInput(tank);
  const fillTank = () => {
    if (tankLiters == null || tankLiters <= 0) return;
    setLiters(formatLiters(tankLiters));
    setAmount(formatEuros(costForLiters(tankLiters, price)));
  };

  const parsedLiters = parseDecimalInput(liters);
  const parsedAmount = parseDecimalInput(amount);

  return (
    <section className="calc" aria-label={`Calculateur de plein (${fuelName})`}>
      <h3 className="calc__title">Calculateur de plein</h3>
      <p className="calc__price">À {formatPriceFull(price)} le litre</p>

      <div className="calc__grid">
        <label className="calc__field" htmlFor={`${idPrefix}-liters`}>
          <span className="calc__label">Litres</span>
          <span className="calc__input">
            <input
              id={`${idPrefix}-liters`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={liters}
              onChange={(e) => onLiters(e.target.value)}
            />
            <span aria-hidden="true">L</span>
          </span>
        </label>

        <span className="calc__swap" aria-hidden="true">
          ⇄
        </span>

        <label className="calc__field" htmlFor={`${idPrefix}-amount`}>
          <span className="calc__label">Montant</span>
          <span className="calc__input">
            <input
              id={`${idPrefix}-amount`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => onAmount(e.target.value)}
            />
            <span aria-hidden="true">€</span>
          </span>
        </label>
      </div>

      {parsedLiters != null && parsedAmount != null && (parsedLiters > 0 || parsedAmount > 0) && (
        <p className="calc__result" role="status">
          {formatLiters(parsedLiters)} L vous coûteront {formatEuros(parsedAmount)}&nbsp;€.
        </p>
      )}

      <div className="calc__tank">
        <label className="calc__label" htmlFor={`${idPrefix}-tank`}>
          Mon réservoir
        </label>
        <div className="calc__tank-row">
          <span className="calc__input calc__input--small">
            <input
              id={`${idPrefix}-tank`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="50"
              value={tank}
              onChange={(e) => setTank(e.target.value)}
            />
            <span aria-hidden="true">L</span>
          </span>
          <button
            type="button"
            className="btn btn--small"
            onClick={fillTank}
            disabled={tankLiters == null || tankLiters <= 0}
          >
            Plein complet
          </button>
        </div>
      </div>
    </section>
  );
}
