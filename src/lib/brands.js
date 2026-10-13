/* -------------------------------------------------------------------------- */
/* Enseignes des stations-service                                             */
/* -------------------------------------------------------------------------- */
/* Les données officielles (data.economie.gouv.fr) ne contiennent AUCUNE      */
/* enseigne : ni « Total », ni « Leclerc », rien. L'enseigne est donc         */
/* enrichie depuis OpenStreetMap (tags brand/operator/name, voir osm.js),     */
/* puis reconnue ici par motifs.                                              */
/*                                                                            */
/* Logos : URLs directes Wikimedia Commons issues des logos officiels         */
/* déclarés sur Wikidata (propriété P154, rang préféré), vérifiées une à une  */
/* (HTTP 200). Les enseignes sans logo vérifié gardent le monogramme aux      */
/* couleurs de l'enseigne, qui sert aussi de repli si l'image échoue          */
/* (hors-ligne, anti-pisteurs) : le composant BrandBadge bascule tout seul.   */

const THUMB = "https://thumb.wikimedia.org/wikipedia/commons/thumb";

const BRAND_LOGOS = {
  totalenergies: `${THUMB}/d/d1/TotalEnergies_wordmark_%282021-present%29.svg/330px-TotalEnergies_wordmark_%282021-present%29.svg.png`,
  "total-access": `${THUMB}/d/d1/TotalEnergies_wordmark_%282021-present%29.svg/330px-TotalEnergies_wordmark_%282021-present%29.svg.png`,
  elf: `${THUMB}/1/1a/Elf_brand_textlogo.svg/330px-Elf_brand_textlogo.svg.png`,
  as24: `${THUMB}/3/39/LOGO_AS_24.png/330px-LOGO_AS_24.png`,
  esso: `${THUMB}/2/22/Esso_textlogo.svg/330px-Esso_textlogo.svg.png`,
  shell: `${THUMB}/e/e3/Shell_wordmark_2019.svg/330px-Shell_wordmark_2019.svg.png`,
  bp: `${THUMB}/d/d3/Bp_textlogo.svg/330px-Bp_textlogo.svg.png`,
  eni: `${THUMB}/7/78/Eni_wordmark.svg/330px-Eni_wordmark.svg.png`,
  avia: `${THUMB}/c/c0/AVIA_International_logo.svg/330px-AVIA_International_logo.svg.png`,
  dyneff: `${THUMB}/9/92/Logo_Dyneff.svg/330px-Logo_Dyneff.svg.png`,
  leclerc: `${THUMB}/1/14/E.Leclerc_logo.svg/330px-E.Leclerc_logo.svg.png`,
  intermarche: `${THUMB}/9/96/Intermarch%C3%A9_logo_2009_classic.svg/330px-Intermarch%C3%A9_logo_2009_classic.svg.png`,
  netto: `${THUMB}/f/fd/French_Netto_logo_2019.svg/330px-French_Netto_logo_2019.svg.png`,
  casino: `${THUMB}/5/57/GroupeCasino.svg/330px-GroupeCasino.svg.png`,
  lidl: `${THUMB}/9/91/Lidl-Logo.svg/330px-Lidl-Logo.svg.png`,
  aldi: `${THUMB}/f/f0/AldiNord-WorldwideLogo.svg/330px-AldiNord-WorldwideLogo.svg.png`,
  // Pas de logo vérifié (badge monogramme) : carrefour, systeme-u, cora,
  // q8, auchan, elan, coccinelle.
};

const BRANDS = [
  { id: "total-access", name: "TotalEnergies Access", bg: "#0057a8", fg: "#ffffff", initials: "TE", tokens: ["total access", "totalenergies access"] },
  { id: "totalenergies", name: "TotalEnergies", bg: "#0057a8", fg: "#ffffff", initials: "TE", tokens: ["totalenergies", "total energies", "total"] },
  { id: "elf", name: "Elf", bg: "#d5001c", fg: "#ffffff", initials: "elf", tokens: ["elf"] },
  { id: "as24", name: "AS 24", bg: "#0057a8", fg: "#ffdd00", initials: "AS", tokens: ["as 24", "as24"] },
  { id: "esso", name: "Esso", bg: "#d52b1e", fg: "#ffffff", initials: "Esso", tokens: ["esso"] },
  { id: "shell", name: "Shell", bg: "#dd1c2a", fg: "#fbce07", initials: "Shell", tokens: ["shell"] },
  { id: "bp", name: "bp", bg: "#009a44", fg: "#ffe500", initials: "bp", tokens: ["bp"] },
  { id: "eni", name: "Eni", bg: "#ffdd00", fg: "#111111", initials: "eni", tokens: ["eni", "agip"] },
  { id: "avia", name: "Avia", bg: "#e30613", fg: "#ffffff", initials: "AVIA", tokens: ["avia"] },
  { id: "dyneff", name: "Dyneff", bg: "#0055a4", fg: "#ffffff", initials: "Dy", tokens: ["dyneff"] },
  { id: "elan", name: "Élan", bg: "#008a45", fg: "#ffffff", initials: "Élan", tokens: ["elan"] },
  { id: "q8", name: "Q8", bg: "#003da5", fg: "#ffffff", initials: "Q8", tokens: ["q8", "kuwait petroleum"] },
  { id: "leclerc", name: "E.Leclerc", bg: "#005daa", fg: "#ffffff", initials: "L", tokens: ["leclerc", "e leclerc"] },
  { id: "carrefour", name: "Carrefour", bg: "#003da5", fg: "#ffffff", initials: "C", tokens: ["carrefour"] },
  { id: "intermarche", name: "Intermarché", bg: "#e2001a", fg: "#ffffff", initials: "IM", tokens: ["intermarche", "roadis"] },
  { id: "netto", name: "Netto", bg: "#ffcc00", fg: "#111111", initials: "N", tokens: ["netto"] },
  { id: "auchan", name: "Auchan", bg: "#e30613", fg: "#ffffff", initials: "A", tokens: ["auchan", "simply"] },
  { id: "systeme-u", name: "Système U", bg: "#003da5", fg: "#ffffff", initials: "U", tokens: ["systeme u", "super u", "hyper u", "u express", "superu", "hyperu"] },
  { id: "casino", name: "Casino", bg: "#008a45", fg: "#ffffff", initials: "ca", tokens: ["casino", "geant", "spar", "viva", "leader price"] },
  { id: "cora", name: "Cora", bg: "#0055a4", fg: "#ffffff", initials: "cora", tokens: ["cora"] },
  { id: "lidl", name: "Lidl", bg: "#0033a0", fg: "#ffdd00", initials: "Lidl", tokens: ["lidl"] },
  { id: "aldi", name: "Aldi", bg: "#00008b", fg: "#ff7f00", initials: "Aldi", tokens: ["aldi"] },
  { id: "coccinelle", name: "Coccinelle", bg: "#6aa84f", fg: "#ffffff", initials: "Co", tokens: ["coccinelle", "cocci"] },
];

/** Normalisation insensible aux accents, à la casse et à la ponctuation. */
export function normalizeBrandText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const tokenPattern = (token) =>
  new RegExp(`(^| )${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);

/**
 * Reconnaît une enseigne à partir d'un ou plusieurs fragments de texte
 * (champ officiel `enseigne` si un jour il existe, tags OSM brand/operator/name).
 * Retourne `{ id, name, bg, fg, initials, logo }` (`logo` = URL du vrai logo,
 * ou `null` → afficher le monogramme) ou `null` si enseigne inconnue.
 */
export function detectBrand(...candidates) {
  const haystack = ` ${candidates.map(normalizeBrandText).filter(Boolean).join(" ")} `;
  if (haystack.trim() === "") return null;
  for (const brand of BRANDS) {
    if (brand.tokens.some((t) => tokenPattern(t).test(haystack))) {
      const { id, name, bg, fg, initials } = brand;
      return { id, name, bg, fg, initials, logo: BRAND_LOGOS[id] ?? null };
    }
  }
  return null;
}
