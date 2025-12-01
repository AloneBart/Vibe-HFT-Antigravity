# 🚀 Vibe HFT - High-Frequency Trading Dashboard

[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Une plateforme de trading haute fréquence pour Bitcoin avec analyse avancée de la microstructure de marché, construite avec Rust et React.

![Dashboard Preview](docs/images/dashboard-preview.png)

## 📋 Table des Matières

- [Caractéristiques](#-caractéristiques)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Utilisation](#-utilisation)
- [Développement](#-développement)
- [Documentation](#-documentation)
- [Roadmap](#-roadmap)
- [Contribution](#-contribution)
- [Licence](#-licence)

## ✨ Caractéristiques

### Actuellement Implémenté

- ✅ **Interface Temps Réel** : Dashboard React avec graphiques TradingView Lightweight Charts
- ✅ **WebSocket Robuste** : Reconnexion automatique avec backoff exponentiel
- ✅ **Mode Simulation** : Test de l'UI sans backend avec données réalistes
- ✅ **Graphiques Interactifs** : Chandelles japonaises et volume en temps réel
- ✅ **Design Cyberpunk** : Interface moderne inspirée des terminaux de trading professionnels

### En Développement

- 🚧 **Backend Rust** : Gateway WebSocket haute performance avec Tokio
- 🚧 **Encodage SBE** : Simple Binary Encoding pour latence ultra-faible
- 🚧 **Module WASM** : Calculs côté client compilés depuis Rust

### Roadmap (Voir [PRD.md](PRD.md))

- 📊 **Order Flow Imbalance (OFI)** : Analyse prédictive du flux d'ordres
- 📊 **Cumulative Volume Delta (CVD)** : Détection des divergences
- 🔥 **Liquidation Heatmaps** : Visualisation des zones de liquidation
- 🌐 **Multi-Exchange** : Agrégation Binance, Bybit, Coinbase
- 🤖 **IA Gemini 3.0** : Analyse sémantique des graphiques

## 🏗️ Architecture

```
vibe-hft/
├── crates/
│   ├── core/              # Types partagés et utilitaires
│   ├── sbe_messages/      # Messages SBE générés
│   ├── market_data/       # Reconstruction du carnet d'ordres L3
│   ├── algo/              # Moteur de stratégies
│   └── wasm_client/       # Client WASM pour le frontend
├── services/
│   └── gateway/           # Serveur WebSocket principal
├── frontend/
│   ├── src/
│   │   ├── components/    # Composants React
│   │   ├── App.tsx        # Application principale
│   │   └── App.css        # Styles
│   └── package.json
├── PRD.md                 # Product Requirements Document
└── ARCHITECTURE_DECISIONS.md
```

### Stack Technique

**Backend**
- **Rust** : Performance et sécurité mémoire
- **Tokio** : Runtime asynchrone
- **SBE** : Encodage binaire zero-copy
- **hftbacktest** : Structures de données pour HFT

**Frontend**
- **React 19** : Framework UI
- **TypeScript** : Typage statique
- **Vite** : Build tool ultra-rapide
- **Lightweight Charts** : Graphiques financiers optimisés
- **WebAssembly** : Calculs haute performance côté client

## 🚀 Installation

### Prérequis

- **Rust** 1.75+ ([Installation](https://rustup.rs/))
- **Node.js** 20+ ([Installation](https://nodejs.org/))
- **wasm-pack** ([Installation](https://rustwasm.github.io/wasm-pack/installer/))

### Installation Rapide

```bash
# Cloner le repository
git clone https://github.com/VOTRE_USERNAME/vibe-hft.git
cd vibe-hft

# Installer les dépendances frontend
cd frontend
npm install

# Compiler le module WASM
cd ../crates/wasm_client
wasm-pack build --target web

# Lier le package WASM
cd ../../frontend
npm link ../crates/wasm_client/pkg

# Démarrer le serveur de développement
npm run dev
```

## 🎮 Utilisation

### Mode Simulation (Sans Backend)

```bash
cd frontend
npm run dev
```

Ouvrez http://localhost:5173 et cliquez sur **"▶ Start Simulation"** pour générer des données de marché fictives.

### Mode Production (Avec Backend)

```bash
# Terminal 1 : Démarrer le Gateway
cd services/gateway
cargo run --release

# Terminal 2 : Démarrer le Frontend
cd frontend
npm run dev
```

Le frontend se connectera automatiquement au WebSocket sur `ws://127.0.0.1:8080`.

## 🛠️ Développement

### Compiler le Backend

```bash
# Build de développement
cargo build

# Build de production (optimisé)
cargo build --release

# Tests
cargo test

# Linter
cargo clippy
```

### Compiler le Frontend

```bash
cd frontend

# Développement avec hot-reload
npm run dev

# Build de production
npm run build

# Preview du build
npm run preview
```

### Compiler le Module WASM

```bash
cd crates/wasm_client

# Build pour le web
wasm-pack build --target web

# Build optimisé
wasm-pack build --target web --release
```

## 📚 Documentation

- **[PRD.md](PRD.md)** : Spécifications produit détaillées
- **[ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)** : Décisions d'architecture et schéma SBE
- **[TEST_REPORT.md](TEST_REPORT.md)** : Rapports de tests

## 🗺️ Roadmap

### Phase 1 : Backend Minimal Viable ✅ (En cours)
- [x] Frontend React fonctionnel
- [x] Mode simulation
- [ ] Gateway WebSocket Rust
- [ ] Intégration WASM basique

### Phase 2 : Indicateurs de Base
- [ ] Connexion Binance WebSocket
- [ ] Calcul OFI temps réel
- [ ] Calcul CVD temps réel
- [ ] Visualisation des indicateurs

### Phase 3 : Multi-Exchange
- [ ] Agrégation Binance + Bybit + Coinbase
- [ ] NOBI (Normalized Order Book Imbalance)
- [ ] Profil de volume global

### Phase 4 : Optimisations
- [ ] Migration vers SBE
- [ ] Heatmaps WebGL
- [ ] Intégration Gemini 3.0

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts)
- [hftbacktest](https://github.com/nkaz001/hftbacktest)
- [Tokio](https://tokio.rs/)
- [wasm-bindgen](https://rustwasm.github.io/wasm-bindgen/)

---

**⚠️ Avertissement** : Ce logiciel est fourni à des fins éducatives uniquement. Le trading comporte des risques importants. Utilisez à vos propres risques.
