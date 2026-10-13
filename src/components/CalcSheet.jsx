import { useEffect, useState } from "react";
import FuelCalculator from "./FuelCalculator.jsx";
import { IconClose } from "./Icons.jsx";
import { parseDecimalInput } from "../lib/calc.js";

/**
 * Calculateur de plein en fenêtre modale (ouvert depuis le bouton à côté
 * d'« Autour de moi ») : calcule au prix le plus bas de la zone, ou au prix
 * saisi à la main s'il n'y a pas encore de données. Échap ferme, toucher
 * hors de la carte aussi, défilement de la page verrouillé.
 */
export default function CalcSheet({ price, fuelName, contextLabel, onClose }) {
  const [manual, setManual] = useState("");

  const manualPrice = parseDecimalInput(manual);
  const effectivePrice =
    price ?? (manualPrice != null && manualPrice > 0 ? manualPrice : null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="calc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calc-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calc-sheet__header">
          <h2 id="calc-sheet-title" className="calc-sheet__title">
            Calculateur de plein
          </h2>
          <button
            type="button"
            className="calc-sheet__close"
            onClick={onClose}
            aria-label="Fermer le calculateur"
            autoFocus
          >
            <IconClose />
          </button>
        </div>

        {price != null ? (
          contextLabel && (
            <p className="calc-sheet__context">Prix le plus bas — {contextLabel}</p>
          )
        ) : (
          <label className="calc-sheet__manual" htmlFor="sheetcalc-price">
            <span className="calc__label">Prix au litre</span>
            <span className="calc__input">
              <input
                id="sheetcalc-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="1,85"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
              <span aria-hidden="true">€/L</span>
            </span>
          </label>
        )}

        {effectivePrice != null ? (
          <FuelCalculator price={effectivePrice} fuelName={fuelName} idPrefix="sheetcalc" />
        ) : (
          <p className="calc-sheet__empty">
            Saisissez un prix au litre pour calculer un plein.
          </p>
        )}
      </div>
    </div>
  );
}
