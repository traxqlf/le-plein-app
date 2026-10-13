/* -------------------------------------------------------------------------- */
/* Couleur d'accent : 5 choix mémorisés, appliqués via `data-accent` sur      */
/* <html> (voir les blocs de variables dans styles.css). Teintes issues des   */
/* couleurs système iOS, déclinées en version claire et sombre.               */
/* -------------------------------------------------------------------------- */

export const ACCENTS = [
  { id: "blue", name: "Bleu", swatch: "#007aff" },
  { id: "purple", name: "Violet", swatch: "#af52de" },
  { id: "pink", name: "Rose", swatch: "#ff2d55" },
  { id: "orange", name: "Orange", swatch: "#ff9500" },
  { id: "green", name: "Vert", swatch: "#34c759" },
];

export const DEFAULT_ACCENT = "blue";

export function normalizeAccent(value) {
  return ACCENTS.some((a) => a.id === value) ? value : DEFAULT_ACCENT;
}
