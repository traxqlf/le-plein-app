// `key` correspond au préfixe des colonnes de l'API : e10_prix, gazole_prix, etc.
// Couleurs officielles par famille (pistolets et signalétique française)

export const FUELS = [
  { key: "e10", label: "SP95-E10", color: "#228B22", ink: "#ffffff" },
  { key: "gazole", label: "Gazole", color: "#FFD700", ink: "#1c1c1e" },
  { key: "sp98", label: "SP98", color: "#008000", ink: "#ffffff" },
  { key: "sp95", label: "SP95", color: "#2E8B57", ink: "#ffffff" },
  { key: "e85", label: "E85", color: "#0033A0", ink: "#ffffff" },
  { key: "gplc", label: "GPLc", color: "#00BFFF", ink: "#ffffff" },
];

export const DEFAULT_FUEL = "e10";

export const fuelLabel = (key) => FUELS.find((f) => f.key === key)?.label ?? key;

/** Couleurs officielles d'un carburant ({ bg, fg }), repli neutre si inconnu. */
export const fuelColors = (key) => {
  const found = FUELS.find((f) => f.key === key);
  return found ? { bg: found.color, fg: found.ink } : { bg: "#6b7280", fg: "#ffffff" };
};

// Libellés affichés pour chaque état de disponibilité d'un carburant.
export const STATUS_LABEL = {
  available: "Disponible",
  temporary: "Rupture temporaire",
  permanent: "Rupture définitive",
  unavailable: "Indisponible",
  absent: "Non proposé",
};
