/* -------------------------------------------------------------------------- */
/* Couleur d'accent : 5 choix mémorisés, appliqués via `data-accent` sur      */
/* <html> (voir les blocs de variables dans styles.css). Teintes issues des   */
/* couleurs système iOS, déclinées en version claire et sombre.               */
/* -------------------------------------------------------------------------- */

export type AccentId = "blue" | "purple" | "pink" | "orange" | "green";

export interface Accent {
  id: AccentId;
  name: string;
  swatch: string;
}

export const ACCENTS: Accent[] = [
  { id: "blue", name: "Bleu", swatch: "#007aff" },
  { id: "purple", name: "Violet", swatch: "#af52de" },
  { id: "pink", name: "Rose", swatch: "#ff2d55" },
  { id: "orange", name: "Orange", swatch: "#ff9500" },
  { id: "green", name: "Vert", swatch: "#34c759" },
];

export const DEFAULT_ACCENT: AccentId = "blue";

export function normalizeAccent(value: unknown): AccentId {
  return ACCENTS.some((a) => a.id === value) ? (value as AccentId) : DEFAULT_ACCENT;
}
