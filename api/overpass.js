/* -------------------------------------------------------------------------- */
/* Proxy Overpass même-origine (utilisé par src/lib/osm.js en premier).       */
/* -------------------------------------------------------------------------- */
/* Pourquoi : l'accès direct au navigateur vers Overpass peut être refusé     */
/* selon le réseau (406 Apache SANS en-têtes CORS — le navigateur bloque      */
/* alors même la lecture de l'erreur — ou files d'attente interminables).     */
/* En passant par cette fonction, la requête part du réseau de Vercel et la   */
/* réponse (GET) est mise en cache au bord réseau. Budget amont : 8 s max ;   */
/* au-delà, 502 et le client bascule sur l'accès direct.                      */

const UPSTREAM = "https://overpass-api.de/api/interpreter";
const UPSTREAM_TIMEOUT_MS = 8000;

export default async function handler(req, res) {
  const data = req.query?.data;
  if (typeof data !== "string" || data.length === 0) {
    res.status(400).json({ error: "paramètre data manquant" });
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "LePlein/1.0 (+https://le-plein.vercel.app)",
      },
      body: `data=${encodeURIComponent(data)}`,
      signal: controller.signal,
    });
    const text = await upstream.text();
    let elements = null;
    try {
      elements = JSON.parse(text).elements;
    } catch {
      /* page d'erreur HTML de l'amont : traitée comme un échec ci-dessous */
    }
    if (!upstream.ok || !Array.isArray(elements)) {
      res.status(502).json({ error: "Overpass injoignable" });
      return;
    }
    // Succès : réponse canonique { elements }, cachée au bord 24 h.
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
    res.status(200).json({ elements });
  } catch {
    res.status(502).json({ error: "Overpass injoignable" });
  } finally {
    clearTimeout(timer);
  }
}
