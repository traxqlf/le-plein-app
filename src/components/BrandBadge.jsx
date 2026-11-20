import { useEffect, useState } from "react";

/**
 * Enseigne : vrai logo (Wikimedia Commons, URL vérifiée) quand il existe,
 * sinon monogramme stylisé aux couleurs de l'enseigne. Si l'image échoue
 * (hors-ligne, anti-pisteurs), bascule toute seule sur le monogramme :
 * il y a toujours quelque chose d'affiché, jamais d'icône cassée.
 * - size "lg" : grand format pour la carte « station la moins chère ».
 * - fallback : pastille neutre ⛽ quand l'enseigne est inconnue.
 * - eager : chargement immédiat (carte hero au-dessus de la ligne de
 *   flottaison) au lieu du chargement paresseux de la liste.
 * Sans enseigne ni fallback : rien.
 */
export default function BrandBadge({ brand, size = "sm", fallback = false, eager = false }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [brand?.logo]);

  if (!brand) {
    if (!fallback) return null;
    return (
      <span className={`station-brand station-brand--${size}`} aria-hidden="true">
        <span className="station-brand__logo station-brand__logo--generic">⛽</span>
      </span>
    );
  }

  const showImg = brand.logo && !imgFailed;

  return (
    <span className={`station-brand station-brand--${size}`}>
      {showImg ? (
        <img
          className="station-brand__img"
          src={brand.logo}
          alt=""
          aria-hidden="true"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="station-brand__logo"
          aria-hidden="true"
          style={{ background: brand.bg, color: brand.fg }}
        >
          {brand.initials}
        </span>
      )}
      <span className="station-brand__name">{brand.name}</span>
    </span>
  );
}
