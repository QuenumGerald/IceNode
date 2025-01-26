# IceNode - Explorateur de Transactions Avalanche

IceNode est un explorateur de transactions pour la blockchain Avalanche, permettant de suivre et d'analyser les transactions à travers différents subnets.

## Fonctionnalités

### Dashboard
- Statistiques en temps réel
  - Nombre de transactions par subnet
  - Volume de transactions par subnet
  - Compteur de smart contracts déployés
- Recherche avancée
  - Par adresse (émetteur/destinataire)
  - Par hash de transaction
  - Par smart contract
- Liste des transactions avec mise à jour automatique
- Liens directs vers Snowtrace
- Filtrage par subnet (C-Chain, DFK, Swimmer, Dexalot)

### API
- Mise à jour en temps réel des transactions
- Statistiques agrégées par subnet
- Endpoints de recherche flexibles
- Surveillance de l'état de santé

## Démarrage Rapide

### Prérequis
- Node.js v18+
- npm ou yarn
- SQLite3

### Installation

1. Cloner le repository
```bash
git clone https://github.com/QuenumGerald/IceNode.git
cd IceNode
```

2. Installer les dépendances
```bash
# Backend
cd backend
npm install

# Frontend
cd ../dashboard
npm install
```

3. Configuration
Créer un fichier `.env` dans le dossier backend :
```env
NODE_ENV=development
PORT=3001
DB_PATH=../data/icenode.db
```

Créer un fichier `.env` dans le dossier dashboard :
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. Lancer l'application
```bash
# Dans le dossier racine
node runAll.js
```

## Architecture

### Frontend (Next.js + TypeScript)
- Framework UI moderne et responsive
- Mise à jour en temps réel (10s)
- Gestion d'état optimisée
- TypeScript pour la sécurité du typage

### Backend (Node.js + Express)
- API RESTful
- Base de données SQLite avec indexes optimisés
- Système de retry pour la connexion DB
- Gestion centralisée des erreurs

### Base de Données
```sql
CREATE TABLE transactions (
    hash TEXT PRIMARY KEY,
    blockNumber INTEGER,
    "from" TEXT,
    "to" TEXT,
    value TEXT,
    timestamp INTEGER,
    subnet TEXT
);

-- Indexes pour les performances
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_from ON transactions("from");
CREATE INDEX idx_transactions_to ON transactions("to");
```

## API Endpoints

### GET /transactions
Liste les transactions récentes
- Query params: `subnet` (optionnel)
- Response: `Transaction[]`

### GET /search
Recherche de transactions
- Query params: 
  - `hash`: Hash de transaction
  - `address`: Adresse wallet
  - `contract`: Adresse contrat
- Response: `Transaction[]`

### GET /stats
Statistiques globales
- Response: 
```json
{
  "transactions": [{ "subnet": string, "count": number }],
  "volumes": [{ "subnet": string, "volume": string }],
  "contracts": { "count": number }
}
```

### GET /health
État de santé de l'API
- Response: `{ "status": "ok" | "error" }`

## Déploiement

L'application est déployée sur Railway :
- Frontend: https://ice-front-production.up.railway.app
- Backend: https://icenode-production.up.railway.app

### Configuration Railway
```toml
[deploy]
healthcheckTimeout = 100
restartPolicyType = "on_failure"

[env]
NODE_ENV = "production"
PORT = "8080"

[[services]]
name = "backend"
buildCommand = "cd backend && npm install"
startCommand = "cd backend && npm start"
healthcheckPath = "/health"
port = 3001

[[services]]
name = "dashboard"
buildCommand = "cd dashboard && npm install && npm run build"
startCommand = "cd dashboard && npm start"
healthcheckPath = "/"
port = 8080
```

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## License

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.
