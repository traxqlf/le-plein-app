import { IconClose, IconShare } from "./Icons.jsx";

export default function InstallBanner({ canInstall, showIOSHint, onInstall, onDismiss }) {
  if (!canInstall && !showIOSHint) return null;
  return (
    <aside className="install" aria-label="Installer l'application">
      <p className="install__text">
        {canInstall ? (
          "Installez Le Plein sur votre écran d'accueil pour l'ouvrir comme une application."
        ) : (
          <>
            Pour installer Le Plein : touchez <IconShare width={16} height={16} className="install__icon" />{" "}
            <strong>Partager</strong>, puis <strong>Sur l'écran d'accueil</strong>.
          </>
        )}
      </p>
      {canInstall && (
        <button type="button" className="btn btn--small" onClick={onInstall}>
          Installer
        </button>
      )}
      <button type="button" className="install__close" onClick={onDismiss} aria-label="Masquer ce message">
        <IconClose width={18} height={18} />
      </button>
    </aside>
  );
}
