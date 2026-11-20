/* -------------------------------------------------------------------------- */
/* Proxy Overpass même-origine (utilisé par src/lib/osm.ts en premier).       */
/* -------------------------------------------------------------------------- */
/* Pourquoi : l'accès direct au navigateur vers Overpass peut être refusé     */
/* selon le réseau (406 Apache SANS en-têtes CORS — le navigateur bloque      */
/* alors même la lecture de l'erreur — ou files d'attente interminables).     */
/* En passant par cette fonction, la requête part du réseau de Vercel et la   */
/* réponse (GET) est mise en cache au bord réseau.                            */
/*                                                                            */
/* Depuis 2026, Overpass filtre sévèrement les clients : un User-Agent sans   */
/* contact, ou les IP de plateformes d'hébergement, reçoivent un 406          */
/* immédiat. On envoie donc un User-Agent descriptif avec contact, et on      */
/* essaie plusieurs instances (dont l'instance française d'OSM-FR) avant de   */
/* renoncer. Budget total volontairement court : au-delà, 502 et le client    */
/* bascule sur ses propres accès directs.                                     */
/* -------------------------------------------------------------------------- */

const UPSTREAMS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
// 3 s par instance : trois échecs restent sous la limite d'exécution Vercel.
const PER_UPSTREAM_TIMEOUT_MS = 3000;
// Contact explicite : exigé par la politique d'usage d'Overpass.
const USER_AGENT = "LePlein/1.0 (PWA prix des carburants; +https://le-plein.vercel.app)";

/** Types minimaux du runtime Vercel (pas de dépendance @vercel/node requise). */
interface VercelRequest {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

/** Interroge une instance ; renvoie les éléments, ou null en cas d'échec. */
async function queryUpstream(url: string, data: string): Promise<unknown[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(data)}`,
      signal: controller.signal,
    });
    const text = await upstream.text();
    if (!upstream.ok) return null;
    try {
      const elements = JSON.parse(text).elements;
      return Array.isArray(elements) ? elements : null;
    } catch {
      return null; // page d'erreur HTML de l'amont : traitée comme un échec
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const data = req.query?.data;
  if (typeof data !== "string" || data.length === 0) {
    res.status(400).json({ error: "paramètre data manquant" });
    return;
  }
  for (const url of UPSTREAMS) {
    const elements = await queryUpstream(url, data);
    if (!elements) continue;
    // Succès : réponse canonique { elements }, cachée au bord 24 h.
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
    res.status(200).json({ elements });
    return;
  }
  res.status(502).json({ error: "Overpass injoignable" });
}
