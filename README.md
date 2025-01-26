 _____ _____ _____ _   _ _____ ____  _____ 
|_   _|     |   __| \ | |     |    \|   __|
  | | |-   -|   __|  \| |  |  |  |  |   __|
  |_| |_____|_____|_|\__|_____|____/|_____|
# IceNode - Avalanche Blockchain Indexer

IceNode est un indexeur blockchain multi-fonctionnel pour Avalanche, permettant de suivre et d'analyser les transactions, les smart contracts, les événements et l'activité des wallets sur la C-Chain et les subnets.

## Fonctionnalités

### 1. Indexation des Transactions (`indexer.js`)
- Indexation en temps réel des transactions sur la C-Chain et les subnets
- Stockage des informations détaillées : hash, adresses, montants, timestamps
- Support multi-subnet (C-Chain, DFK, Dexalot)

### 2. Suivi des Smart Contracts (`contractIndexer.js`)
- Détection des déploiements de smart contracts
- Stockage des informations de déploiement :
  - Adresse du contrat
  - Adresse du déployeur
  - Bytecode de déploiement
  - Timestamp et numéro de bloc
  - Statut de vérification

### 3. Surveillance des Événements (`eventIndexer.js`)
- Écoute en temps réel des événements des smart contracts
- Support des événements standards (ERC20, ERC721, DEX, Staking)
- Stockage des événements avec :
  - Nom de l'événement
  - Paramètres décodés
  - Informations de transaction
  - Support multi-contrat

### 4. Analyse des Wallets (`walletIndexer.js`)
- Suivi de l'activité des wallets
- Statistiques par wallet :
  - Première et dernière activité
  - Nombre de transactions
  - Valeur totale transférée
  - Distinction EOA/Smart Contract
- Support multi-subnet

## Installation

1. Cloner le repository :
\`\`\`bash
git clone https://github.com/votre-username/icenode.git
cd icenode
\`\`\`

2. Installer les dépendances :
\`\`\`bash
npm install
\`\`\`

3. Configurer les variables d'environnement :
\`\`\`bash
cp .env.example .env
\`\`\`

Éditer le fichier .env avec vos paramètres :
\`\`\`
RPC_URL=https://api.avax.network/ext/bc/C/rpc
SUBNET_RPC_URLS={"DFK":"https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc","Dexalot":"https://subnets.avax.network/dexalot/mainnet/rpc"}
DB_PATH=/chemin/vers/votre/base/icenode.db
\`\`\`

## Utilisation

### Démarrer tous les services
\`\`\`bash
node runAll.js
\`\`\`

### Démarrer les services individuellement

1. Indexeur de transactions :
\`\`\`bash
node indexer.js
\`\`\`

2. Indexeur de smart contracts :
\`\`\`bash
node contractIndexer.js
\`\`\`

3. Indexeur d'événements :
\`\`\`bash
node eventIndexer.js
\`\`\`

4. Indexeur de wallets :
\`\`\`bash
node walletIndexer.js
\`\`\`

### Réinitialiser la base de données
\`\`\`bash
node resetDatabase.js
\`\`\`

## Structure de la Base de Données

### Table \`transactions\`
- \`hash\` (TEXT PRIMARY KEY)
- \`from_address\` (TEXT)
- \`to_address\` (TEXT)
- \`amount\` (TEXT)
- \`timestamp\` (INTEGER)
- \`subnet\` (TEXT)
- \`block_number\` (INTEGER)

### Table \`contract_deployments\`
- \`contract_address\` (TEXT PRIMARY KEY)
- \`deployer_address\` (TEXT)
- \`deployment_tx_hash\` (TEXT)
- \`bytecode\` (TEXT)
- \`timestamp\` (INTEGER)
- \`block_number\` (INTEGER)
- \`subnet\` (TEXT)
- \`verified\` (BOOLEAN)

### Table \`contract_events\`
- \`id\` (INTEGER PRIMARY KEY)
- \`contract_address\` (TEXT)
- \`event_name\` (TEXT)
- \`parameters\` (TEXT)
- \`block_number\` (INTEGER)
- \`transaction_hash\` (TEXT)
- \`log_index\` (INTEGER)
- \`timestamp\` (INTEGER)
- \`subnet\` (TEXT)

### Table \`active_wallets\`
- \`wallet_address\` (TEXT)
- \`subnet\` (TEXT)
- \`first_seen\` (INTEGER)
- \`last_active_timestamp\` (INTEGER)
- \`transaction_count\` (INTEGER)
- \`total_value_transferred\` (TEXT)
- \`is_contract\` (BOOLEAN)
- PRIMARY KEY (wallet_address, subnet)

## API et Requêtes Utiles

### Exemples de requêtes SQL

1. Trouver les wallets les plus actifs :
\`\`\`sql
SELECT wallet_address, transaction_count, total_value_transferred 
FROM active_wallets 
WHERE subnet = 'C-Chain' 
ORDER BY transaction_count DESC 
LIMIT 10;
\`\`\`

2. Lister les derniers contrats déployés :
\`\`\`sql
SELECT contract_address, deployer_address, timestamp 
FROM contract_deployments 
ORDER BY timestamp DESC 
LIMIT 10;
\`\`\`

3. Voir les derniers événements d'un contrat :
\`\`\`sql
SELECT event_name, parameters, timestamp 
FROM contract_events 
WHERE contract_address = '0x...' 
ORDER BY timestamp DESC;
\`\`\`

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## Licence

MIT License - voir le fichier LICENSE pour plus de détails.

## Contact

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue sur GitHub.
