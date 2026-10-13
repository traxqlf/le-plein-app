# Le Plein

Prix et disponibilité des carburants autour de vous. Application web **React** installable
sur iOS et Android (PWA), sans passer par l'App Store ni le Play Store.

- Données : jeu « Prix des carburants en France – flux instantané v2 » (data.economie.gouv.fr),
  mis à jour toutes les 10 minutes, avec les ruptures de stock déclarées par les stations.
- Recherche de ville : géocodeur de la Géoplateforme (data.geopf.fr), sans clé.
- Carte : Leaflet + OpenStreetMap.
- Aucun serveur, aucune clé d'API : tout tourne dans le navigateur.

## Démarrer

Node.js 20.19 ou plus récent.

```bash
npm install          # installe les dépendances
npm run dev          # serveur de dev sur http://localhost:5173
npm test             # tests unitaires (normalisation des données, prix, distances)
npm run build        # construit le site dans dist/
npm run preview      # sert dist/ (le service worker PWA n'existe qu'en build)
```

## Publier sur internet

Le site est 100 % statique. Sur Vercel, Netlify ou Cloudflare Pages :

| Réglage           | Valeur          |
| ----------------- | --------------- |
| Build command     | `npm run build` |
| Output directory  | `dist`          |

Il faut du **HTTPS** (fourni automatiquement par ces services) : la géolocalisation et
l'installation en PWA en dépendent.

GitHub Pages : si le site est dans un sous-dossier (`https://user.github.io/mon-repo/`),
mettez `base: "/mon-repo/"` dans `vite.config.js` et adaptez `start_url` et `scope`
du manifest.

## Installer sur un téléphone

- **Android (Chrome)** : bouton « Installer » dans l'appli, ou menu ⋮ → « Installer l'application ».
- **iPhone / iPad (Safari uniquement)** : bouton Partager → « Sur l'écran d'accueil ».

Tester sur son téléphone en local : `http://IP-du-PC:4173` n'est pas en HTTPS, donc la
géolocalisation et l'installation ne fonctionneront pas. Utilisez plutôt un déploiement
de prévisualisation (Vercel/Netlify), ou un tunnel HTTPS (`npx cloudflared tunnel --url http://localhost:4173`).

## Structure

```
src/
  App.jsx                  état global, tri/filtre, mise en page
  lib/api.js               appels API + normalisation des champs (à adapter si le schéma change)
  lib/fuels.js             carburants et libellés de disponibilité
  lib/format.js, geo.js    prix, dates, distances, lien d'itinéraire
  hooks/                   position, stations (rafraîchies toutes les 10 min), installation PWA
  components/              PriceSign (le « pylône »), StationRow, StationMap, ...
  styles.css               tout le design (variables en tête de fichier)
public/                    icônes PWA et favicon
vite.config.js             manifest PWA + stratégie de cache hors-ligne
```

## Points à connaître

- **Champs de l'API** : `src/lib/api.js` suppose les noms `<carburant>_prix`,
  `<carburant>_maj`, `carburants_rupture_temporaire`, `carburants_rupture_definitive`,
  `carburants_indisponibles`, `geom`. Si l'écran reste vide, ouvrez la console du navigateur :
  un avertissement indique si le schéma a changé. Comparez avec
  https://data.economie.gouv.fr/api/explore/v2.1/console
- **Les noms d'enseigne ne sont pas dans ce jeu de données** : la liste affiche l'adresse.
- **La disponibilité** est celle que les stations déclarent, pas un comptage en temps réel.
- **Tuiles OpenStreetMap** : correct pour un projet perso ; pour un fort trafic, passez à un
  fournisseur de tuiles dédié (MapTiler, Stadia…) en changeant l'URL dans `StationMap.jsx`
  et dans `vite.config.js`.