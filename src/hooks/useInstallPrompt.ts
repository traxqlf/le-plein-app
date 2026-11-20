import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON } from "../lib/storage.ts";

const DISMISS_KEY = "leplein:install-dismissed";

/** Événement Chromium (non standard) émis quand la PWA est installable. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOSSafari = (): boolean => {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
};

/**
 * Android/Chrome : capte l'événement `beforeinstallprompt` pour proposer un bouton « Installer ».
 * iOS/Safari : pas d'événement, on affiche une aide pour « Sur l'écran d'accueil ».
 */
export default function useInstallPrompt(): {
  canInstall: boolean;
  showIOSHint: boolean;
  install: () => void;
  dismiss: () => void;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => readJSON<boolean>(DISMISS_KEY, false));
  const [standalone, setStandalone] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event): void => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeJSON(DISMISS_KEY, true);
  }, []);

  const hidden = standalone || dismissed;
  return {
    canInstall: !hidden && deferred !== null,
    showIOSHint: !hidden && deferred === null && isIOSSafari(),
    install,
    dismiss,
  };
}
