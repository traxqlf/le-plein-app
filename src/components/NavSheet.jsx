import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./Icons.jsx";

/**
 * Choix de l'application GPS : Google Maps, Waze, Apple Plans (deep links
 * universels avec les coordonnées). La case mémorise le choix (localStorage)
 * via `onSave` ; « Oublier » l'efface pour reposer la question.
 */
export default function NavSheet({ urls, savedId, onSave, onClose }) {
  const [always, setAlways] = useState(savedId != null);

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

  const pick = (id) => {
    if (always) onSave(id);
    onClose();
  };

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="calc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nav-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calc-sheet__header">
          <h2 id="nav-sheet-title" className="calc-sheet__title">
            Y aller avec…
          </h2>
          <button
            type="button"
            className="calc-sheet__close"
            onClick={onClose}
            aria-label="Fermer le choix du GPS"
            autoFocus
          >
            <IconClose />
          </button>
        </div>

        <ul className="nav__list">
          {urls.map((app) => (
            <li key={app.id}>
              <a
                className={`nav__app${savedId === app.id ? " is-default" : ""}`}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => pick(app.id)}
              >
                <span className="nav__name">
                  {app.name}
                  {savedId === app.id && <span className="nav__default">Par défaut</span>}
                </span>
                <span className="nav__open" aria-hidden="true">
                  ›
                </span>
              </a>
            </li>
          ))}
        </ul>

        <label className="nav__always">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
          Toujours utiliser cette application
        </label>

        {savedId != null && (
          <button
            type="button"
            className="nav__forget"
            onClick={() => {
              onSave(null);
              setAlways(false);
            }}
          >
            Oublier mon choix
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
