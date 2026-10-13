import { useEffect, useState } from "react";

/**
 * true quand le thème résolu est sombre. Suit le bouton de thème ET l'OS en
 * direct (mode "system") : les deux passent par `data-theme` sur <html>,
 * observé ici (attribut posé par App.jsx et le script anti-flash).
 */
export default function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");

  useEffect(() => {
    const update = () => setDark(document.documentElement.dataset.theme === "dark");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return dark;
}
