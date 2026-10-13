/* -------------------------------------------------------------------------- */
/* Préférence de thème : "system" (défaut, suit l'appareil en direct),        */
/* "light" ou "dark" (choix manuel prioritaire, mémorisé).                    */
/* -------------------------------------------------------------------------- */

const THEMES = ["system", "light", "dark"];

export const THEME_LABELS = { system: "automatique", light: "clair", dark: "sombre" };

export const THEME_META_COLORS = { light: "#ffffff", dark: "#000000" };

/**
 * Applique la couleur de la barre native (iOS / Safari / PWA).
 * On REMPLACE le nœud <meta> plutôt que setAttribute : Safari ne relit la
 * couleur que quand la balise change, les autres navigateurs suivent pareil.
 */
export function setThemeMetaColor(color) {
  try {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head?.querySelector('meta[name="theme-color"]')?.replaceWith(meta) ??
      document.head?.appendChild(meta);
  } catch {
    /* DOM indisponible (SSR/tests) : rien à synchroniser */
  }
}

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
