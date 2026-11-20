import { useEffect, useState } from "react";

export default function useDarkMode(): boolean {
  const [dark, setDark] = useState<boolean>(() => document.documentElement.dataset.theme === "dark");

  useEffect(() => {
    const update = (): void => setDark(document.documentElement.dataset.theme === "dark");
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
