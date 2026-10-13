/* -------------------------------------------------------------------------- */
/* Préférence de thème : "system" (défaut, suit l'appareil en direct),        */
/* "light" ou "dark" (choix manuel prioritaire, mémorisé).                    */
/* -------------------------------------------------------------------------- */

export const THEMES = ["system", "light", "dark"];

export const THEME_LABELS = { system: "automatique", light: "clair", dark: "sombre" };

export const THEME_META_COLORS = { light: "#f2f2f7", dark: "#000000" };

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : "system";
}

/** Thème effectif : "dark" ou "light". */
export function resolveTheme(stored, systemPrefersDark) {
  const mode = normalizeTheme(stored);
  return mode === "dark" || (mode === "system" && systemPrefersDark) ? "dark" : "light";
}

/** Ordre du bouton : automatique -> clair -> sombre -> automatique… */
export function nextTheme(mode) {
  return THEMES[(THEMES.indexOf(normalizeTheme(mode)) + 1) % THEMES.length];
}
