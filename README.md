# ⛽ Le Plein. (Tutorial in English below 🇬🇧)

Une application web progressive (PWA) moderne, rapide et intuitive développée avec **React** et **JavaScript**, permettant de trouver en temps réel les stations-service les moins chères autour de soi en France.

---

## 🌐 Accès en ligne (Live App)
Aucune installation requise ! Accédez directement à l'application depuis votre navigateur (mobile ou ordinateur) :
* **[👉 Ouvrir l'application : https://le-plein.vercel.app](https://le-plein.vercel.app)**

## 📱 Installation sur téléphone (PWA)
Pour profiter de **Le Plein.** comme d'une véritable application native (plein écran, icône sur l'écran d'accueil et barre d'état synchronisée) :
* **Sur iOS (Safari) :** Ouvrez le lien, appuyez sur le bouton **Partager** (carré avec flèche vers le haut) puis sélectionnez **Sur l'écran d'accueil**.
* **Sur Android (Chrome) :** Ouvrez le lien, appuyez sur le menu **⋮** puis sélectionnez **Installer l'application**.

```bash
npm install          # installe les dépendances
npm run dev          # serveur de dev sur http://localhost:5173
npm test             # tests unitaires (normalisation des données, prix, distances)
npm run typecheck    # vérification TypeScript (tsc --noEmit)
npm run build        # construit le site dans dist/
npm run preview      # sert dist/ (le service worker PWA n'existe qu'en build)

## ✨ Fonctionnalités
* 📍 **Géolocalisation intelligente :** Détection automatique des stations autour de votre position ou recherche manuelle par ville / code postal.
* ⛽ **Filtres complets :** Sélection du carburant (**SP95-E10**, **Gazole**, **SP98**, **SP95**, **E85**, **GPLc**), ajustement du rayon de recherche (`2 km` à `20 km`), tri par prix ou distance, et masquage des ruptures de stock.
* 🔥 **Mise en avant du meilleur tarif :** Identification immédiate de la station la moins chère dans votre périmètre avec calcul d'itinéraire rapide (*Y aller*).
* 🗺️ **Double affichage Liste & Carte :** Navigation fluide entre la vue détaillée en liste et une carte interactive avec pastilles de prix dynamiques.
* 🌗 **Thème adaptatif :** Bascule instantanée entre le mode clair et le mode sombre, synchronisée avec la barre d'état native sur iOS et macOS.
* 🧮 **Calculateur intégré :** Outil rapide pour estimer le coût de votre plein selon le volume souhaité.

## 🛠️ Prérequis (Pour les développeurs)
Pour exécuter et modifier ce projet localement depuis le code source :
* **Node.js** (v18 ou version supérieure).
* **npm** (ou Yarn / pnpm).
* Une clé API pour le fournisseur de fonds de carte (Mapbox / Stadia Maps / Jawg).

## 🚀 Installation & Utilisation (Via le code source)

1. **Cloner le dépôt sur votre machine :**
   ```bash
   git clone https://github.com/traxqlf/le-plein-app.git
   cd le-plein-app
   ```

2. **Installer les dépendances :**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement :**
   Créez un fichier `.env` à la racine du projet et ajoutez votre clé API cartographique :
   ```env
   VITE_MAP_API_KEY=votre_cle_api_ici
   ```

4. **Lancer le serveur de développement :**
   ```bash
   npm run dev
   ```

<br>
<br>

# ⛽ Le Plein. (English 🇬🇧)

A modern, fast, and intuitive Progressive Web App (PWA) built with **React** and **JavaScript**, designed to find the cheapest gas stations around you in France in real time.

---

```
src/
  App.tsx                  état global, tri/filtre, mise en page
  lib/api.ts               appels API + normalisation des champs (à adapter si le schéma change)
  lib/fuels.ts             carburants et libellés de disponibilité
  lib/format.ts, geo.ts    prix, dates, distances, lien d'itinéraire
  hooks/                   position, stations (rafraîchies toutes les 10 min), installation PWA
  components/              PriceSign (le « pylône »), StationRow, StationMap, ...
  styles.css               tout le design (variables en tête de fichier)
public/                    icônes PWA et favicon
vite.config.js             manifest PWA + stratégie de cache hors-ligne
```

## 📱 Install on Mobile (PWA)
To enjoy **Le Plein.** like a native mobile app (full-screen mode, home screen icon, and synced status bar):
* **On iOS (Safari):** Open the link, tap the **Share** button, and select **Add to Home Screen**.
* **On Android (Chrome):** Open the link, tap the **⋮** menu, and select **Install app**.

- **Champs de l'API** : `src/lib/api.ts` suppose les noms `<carburant>_prix`,
  `<carburant>_maj`, `carburants_rupture_temporaire`, `carburants_rupture_definitive`,
  `carburants_indisponibles`, `geom`. Si l'écran reste vide, ouvrez la console du navigateur :
  un avertissement indique si le schéma a changé. Comparez avec
  https://data.economie.gouv.fr/api/explore/v2.1/console
- **Les noms d'enseigne ne sont pas dans ce jeu de données** : la liste affiche l'adresse.
- **La disponibilité** est celle que les stations déclarent, pas un comptage en temps réel.
- **Tuiles OpenStreetMap** : correct pour un projet perso ; pour un fort trafic, passez à un
  fournisseur de tuiles dédié (MapTiler, Stadia…) en changeant l'URL dans `StationMap.tsx`
  et dans `vite.config.ts`.