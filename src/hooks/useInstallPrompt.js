import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON } from "../lib/storage.js";

const DISMISS_KEY = "leplein:install-dismissed";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
};

/**
 * Android/Chrome : capte l'événement `beforeinstallprompt` pour proposer un bouton « Installer ».
 * iOS/Safari : pas d'événement, on affiche une aide pour « Sur l'écran d'accueil ».
 */
export default function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => readJSON(DISMISS_KEY, false));
  const [standalone, setStandalone] = useState(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
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
