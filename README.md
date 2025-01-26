# IceNode - Avalanche Blockchain Explorer

Un explorateur de blockchain complet pour Avalanche, permettant de suivre les transactions, les contrats intelligents et les statistiques sur la chaîne principale et les sous-réseaux.

## Fonctionnalités

- 🔍 Exploration des transactions en temps réel
- 📊 Statistiques de la blockchain
- 🌐 Support des sous-réseaux (DFK, Dexalot)
- 📱 Interface utilisateur moderne et réactive
- 🚀 Indexation performante

## Installation

```bash
# Installer les dépendances
npm run install:all

# Démarrer en développement
npm start

# Ou démarrer séparément
npm run start:backend    # Pour l'API et les indexeurs
npm run start:dashboard  # Pour l'interface utilisateur
```

## Structure du Projet

```
/icenode
  ├── backend/          # Services d'indexation et API
  │   ├── src/         # Code source
  │   └── data/        # Base de données SQLite
  ├── dashboard/        # Interface utilisateur Next.js
  └── package.json     # Scripts et dépendances
```

## Configuration

Créez un fichier `.env` à la racine du projet :

```env
RPC_URL=https://api.avax.network/ext/bc/C/rpc
SUBNET_RPC_URLS={"DFK":"https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc"}
```

## API Endpoints

- `GET /transactions` : Liste des dernières transactions
- `GET /stats` : Statistiques globales
- `GET /search` : Recherche de transactions/adresses

## Déploiement

Le projet est configuré pour être déployé sur Railway :

```bash
# Installation de Railway CLI
npm i -g @railway/cli

# Déploiement
railway up
```

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## Licence

MIT
