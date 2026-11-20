import { useEffect, useRef } from "react";
import { FUELS } from "../lib/fuels.js";

/** Groupe de boutons radio « segmenté » (rayon, tri). */
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segmented__btn"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FuelPicker({ value, onChange }) {
  const ref = useRef(null);

  // En bout de course à droite, on retire l'estompage (.is-end) : le dernier
  // bouton reste entièrement visible au lieu d'être rogné par le dégradé.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      el.classList.toggle("is-end", el.scrollWidth - el.scrollLeft - el.clientWidth < 4);
    };
    // Souris : la molette est verticale mais la rangée défile en horizontal.
    // On traduit donc la molette verticale en scroll horizontal (mise en
    // page inchangée : une seule ligne). Scroll ISOLÉ : la liste des
    // stations ne bouge jamais quand on molette sur les carburants, même
    // en bout de course (le surplus est absorbé, pas renvoyé).
    // Le trackpad horizontal garde son comportement natif.
    // Listener non-passif pour pouvoir preventDefault.
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      if (e.deltaY === 0) return;
      if (e.deltaX !== 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      e.stopPropagation(); // isolé : App.jsx ne renvoie rien vers la liste
      const max = el.scrollWidth - el.clientWidth;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
      el.scrollLeft = Math.min(max, Math.max(0, el.scrollLeft + e.deltaY * unit));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className="fuels" role="radiogroup" aria-label="Carburant">
      {FUELS.map((f) => (
        <button
          key={f.key}
          type="button"
          role="radio"
          aria-checked={f.key === value}
          className="fuels__chip"
          style={{ "--fuel": f.color, "--fuel-ink": f.ink }}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, children }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true" />
      <span className="switch__text">{children}</span>
    </label>
  );
}
