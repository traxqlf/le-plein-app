/* -------------------------------------------------------------------------- */
/* Préférence de thème : "system" (défaut, suit l'appareil en direct),        */
/* "light" ou "dark" (choix manuel prioritaire, mémorisé).                    */
/* -------------------------------------------------------------------------- */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEMES: readonly ThemeMode[] = ["system", "light", "dark"];

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: "automatique",
  light: "clair",
  dark: "sombre",
};

export const THEME_META_COLORS: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#000000",
};

/**
 * Applique la couleur de la barre native (iOS / Safari / PWA).
 * On REMPLACE le nœud <meta> plutôt que setAttribute : Safari ne relit la
 * couleur que quand la balise change, les autres navigateurs suivent pareil.
 */
export function setThemeMetaColor(color: string): void {
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

export function normalizeTheme(value: unknown): ThemeMode {
  return (THEMES as readonly string[]).includes(value as string) ? (value as ThemeMode) : "system";
}

/** Thème effectif : "dark" ou "light". */
export function resolveTheme(stored: unknown, systemPrefersDark: boolean): ResolvedTheme {
  const mode = normalizeTheme(stored);
  return mode === "dark" || (mode === "system" && systemPrefersDark) ? "dark" : "light";
}

/** Ordre du bouton : automatique -> clair -> sombre -> automatique… */
export function nextTheme(mode: unknown): ThemeMode {
  return THEMES[(THEMES.indexOf(normalizeTheme(mode)) + 1) % THEMES.length];
}
