import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Si vous publiez sur GitHub Pages dans un sous-dossier (https://user.github.io/mon-repo/),
// mettez base: "/mon-repo/" ici ET start_url / scope dans le manifest ci-dessous.
export default defineConfig({
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
            // Tuiles de la carte : le cache d'abord, elles changent rarement.
            urlPattern: ({ url }) => url.hostname === "tile.openstreetmap.org",
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fond sombre CARTO (dark mode) : mêmes règles que les tuiles OSM.
            urlPattern: ({ url }) => url.hostname.endsWith("basemaps.cartocdn.com"),
            handler: "CacheFirst",
            options: {
              cacheName: "carto-tiles",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
