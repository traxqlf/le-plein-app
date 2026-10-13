import { useEffect, useRef, useState } from "react";
import usePersistentState from "../hooks/usePersistentState.js";
import { ACCENTS, normalizeAccent } from "../lib/accent.js";

/**
 * Sélecteur de couleur d'accent : pastille de la couleur active dans
 * l'en-tête, menu déroulant vers le bas au toucher (5 lignes avec pastille
 * + nom + coche). Le menu se referme au choix, à Échap ou au toucher
 * extérieur (détecté au niveau du document : aucun voile plein écran).
 * Le choix est mémorisé et appliqué via `data-accent` sur <html>.
 */
export default function AccentPicker() {
  const [stored, setStored] = usePersistentState("leplein:accent", "blue");
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = normalizeAccent(stored);
  const active = ACCENTS.find((a) => a.id === current);

  useEffect(() => {
    document.documentElement.dataset.accent = current;
  }, [current]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="accent" ref={rootRef}>
      <button
        type="button"
        className="topbar__theme"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Couleur d'accent : ${active.name} — toucher pour changer`}
        title={`Couleur d'accent : ${active.name}`}
      >
        <span className="accent__dot" style={{ background: active.swatch }} aria-hidden="true" />
      </button>
      {open && (
        <div className="accent__pop" role="radiogroup" aria-label="Couleur d'accent">
          <ul className="nav__list">
            {ACCENTS.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="nav__app nav__app--compact"
                    role="radio"
                  aria-checked={a.id === current}
                  onClick={() => {
                    setStored(a.id);
                    setOpen(false);
                  }}
                >
                  <span className="accent__dot" style={{ background: a.swatch }} aria-hidden="true" />
                  <span className="nav__name">{a.name}</span>
                  {a.id === current && (
                    <span className="accent__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
