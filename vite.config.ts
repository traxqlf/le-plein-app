import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// En dev, `vite dev` ne fait PAS tourner api/overpass.ts (fonction serverless
// Vercel) : sans proxy dédié, /api/overpass répondait l'index.html en 200
// text/html, et src/lib/osm.ts recevait du HTML au lieu de JSON. On route donc
// /api/overpass directement vers une instance Overpass, avec les en-têtes que
// le service attend (Accept JSON + User-Agent descriptif exigé depuis 2026).
// Surchargeable : OVERPASS_DEV_TARGET=https://overpass.private.coffee/api/interpreter npm run dev
const OVERPASS_DEV_TARGET = process.env.OVERPASS_DEV_TARGET ?? "https://overpass-api.de/api/interpreter";
const overpassDevUrl = new URL(OVERPASS_DEV_TARGET);

// Si vous publiez sur GitHub Pages dans un sous-dossier (https://user.github.io/mon-repo/),
// mettez base: "/mon-repo/" ici ET start_url / scope dans le manifest ci-dessous.
export default defineConfig({
  server: {
    proxy: {
      // Doit rester AVANT "/api" : la première clé correspondante gagne.
      "/api/overpass": {
        target: overpassDevUrl.origin,
        changeOrigin: true,
        secure: true,
        // /api/overpass?data=… -> /api/interpreter?data=… (la query est conservée)
        rewrite: (path) => path.replace(/^\/api\/overpass/, overpassDevUrl.pathname),
        headers: {
          Accept: "application/json",
          "User-Agent": "LePlein/1.0 (PWA prix des carburants; +https://le-plein.vercel.app)",
        },
        timeout: 15000,
        proxyTimeout: 15000,
      },
      // Reste des routes /api : proxy vers la prod (comportement Vercel).
      "/api": { target: "https://le-plein.vercel.app", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Le Plein – prix et disponibilité des carburants",
        short_name: "Le Plein",
        description: "Prix officiels et ruptures de stock des stations autour de vous.",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f2f2f7",
        theme_color: "#f2f2f7",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Prix : on essaie le réseau d'abord, le cache sert de secours hors-ligne.
            urlPattern: ({ url }) => url.hostname === "data.economie.gouv.fr",
            handler: "NetworkFirst",
            options: {
              cacheName: "prix-carburants",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Tuiles OSM (clair + sombre style Leaflet : mêmes tuiles, le
            // sombre est un filtre CSS local) : le cache d'abord.
            urlPattern: ({ url }) => url.hostname === "tile.openstreetmap.org",
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
