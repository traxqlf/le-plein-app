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

---

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

## 🌐 Live Access
No installation required! Access the application directly from your mobile or desktop browser:
* **[👉 Launch the App: https://le-plein.vercel.app](https://le-plein.vercel.app)**

## 📱 Install on Mobile (PWA)
To enjoy **Le Plein.** like a native mobile app (full-screen mode, home screen icon, and synced status bar):
* **On iOS (Safari):** Open the link, tap the **Share** button, and select **Add to Home Screen**.
* **On Android (Chrome):** Open the link, tap the **⋮** menu, and select **Install app**.

---

## ✨ Features
* 📍 **Smart Geolocation:** Automatic detection of nearby gas stations or manual search by city / postal code.
* ⛽ **Comprehensive Filters:** Fuel type selection (**SP95-E10**, **Diesel**, **SP98**, **SP95**, **E85**, **LPG**), adjustable search radius (`2 km` to `20 km`), sorting by price or distance, and option to hide out-of-stock stations.
* 🔥 **Best Deal Highlight:** Instant spotlight on the cheapest station in your area with one-tap navigation directions.
* 🗺️ **Dual List & Map View:** Seamless switching between a detailed list view and an interactive map with dynamic price tags.
* 🌗 **Adaptive Theme:** Instant toggle between Light and Dark modes, dynamically synced with the native status bar on iOS and macOS.
* 🧮 **Built-in Calculator:** Handy tool to estimate the total cost of your refueling based on your tank volume.

## 🛠️ Prerequisites (For Developers)
To run and customize this project locally from the source code, you will need:
* **Node.js** (v18 or newer).
* **npm** (or Yarn / pnpm).
* An API key for your map tile provider (Mapbox / Stadia Maps / Jawg).

## 🚀 Installation & Usage (From Source Code)

1. **Clone the repository to your machine:**
   ```bash
   git clone https://github.com/traxqlf/le-plein-app.git
   cd le-plein-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory and add your map API key:
   ```env
   VITE_MAP_API_KEY=your_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
