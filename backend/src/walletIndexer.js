const ethers = require('ethers');
const db = require('./database');
require('dotenv').config();

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUBNET_RPC_URLS = JSON.parse(process.env.SUBNET_RPC_URLS || '{}');

class WalletIndexer {
    constructor() {
        // Créer les providers pour chaque subnet
        this.providers = {
            'C-Chain': new ethers.providers.JsonRpcProvider(RPC_URL)
        };

        // Ajouter les providers pour les subnets
        for (const [subnet, url] of Object.entries(SUBNET_RPC_URLS)) {
            this.providers[subnet] = new ethers.providers.JsonRpcProvider(url);
        }

        // Initialiser la base de données
        this.initDatabase();
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            // Créer la table des wallets actifs
            db.run(`
                CREATE TABLE IF NOT EXISTS active_wallets (
                    wallet_address TEXT,
                    subnet TEXT,
                    first_seen INTEGER,
                    last_active_timestamp INTEGER,
                    transaction_count INTEGER DEFAULT 0,
                    total_value_transferred TEXT DEFAULT '0',
                    is_contract BOOLEAN DEFAULT 0,
                    PRIMARY KEY (wallet_address, subnet)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating active_wallets table:', err);
                    reject(err);
                } else {
                    console.log('Active wallets table ready');
                    resolve();
                }
            });

            // Créer un index pour les recherches rapides
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_wallet_activity 
                ON active_wallets(subnet, last_active_timestamp)
            `);
        });
    }

    // Mettre à jour les statistiques d'un wallet
    async updateWalletStats(wallet, subnet, timestamp, value = '0') {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO active_wallets 
                (wallet_address, subnet, first_seen, last_active_timestamp, transaction_count, total_value_transferred)
                VALUES (?, ?, ?, ?, 1, ?)
                ON CONFLICT(wallet_address, subnet) DO UPDATE SET
                last_active_timestamp = MAX(last_active_timestamp, excluded.last_active_timestamp),
                transaction_count = transaction_count + 1,
                total_value_transferred = CAST(CAST(total_value_transferred AS DECIMAL) + CAST(? AS DECIMAL) AS TEXT)
            `, [
                wallet.toLowerCase(),
                subnet,
                timestamp,
                timestamp,
                value,
                value
            ], (err) => {
                if (err) {
                    console.error(`Error updating wallet stats for ${wallet}:`, err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Marquer une adresse comme étant un contrat
    async markAsContract(address, subnet) {
        return db.run(
            'UPDATE active_wallets SET is_contract = 1 WHERE wallet_address = ? AND subnet = ?',
            [address.toLowerCase(), subnet]
        );
    }

    // Traiter un bloc
    async processBlock(blockNumber, subnet) {
        try {
            const provider = this.providers[subnet];
            console.log(`Processing block ${blockNumber} on ${subnet}...`);
            
            // Récupérer le bloc avec toutes ses transactions
            const block = await provider.getBlock(blockNumber, true);
            if (!block) {
                console.error(`Block ${blockNumber} not found on ${subnet}`);
                return;
            }

            // Traiter chaque transaction
            for (const tx of block.transactions) {
                // Mettre à jour les stats du sender
                await this.updateWalletStats(
                    tx.from,
                    subnet,
                    block.timestamp,
                    tx.value.toString()
                );

                // Mettre à jour les stats du receiver (s'il existe)
                if (tx.to) {
                    await this.updateWalletStats(
                        tx.to,
                        subnet,
                        block.timestamp,
                        tx.value.toString()
                    );

                    // Vérifier si l'adresse de destination est un contrat
                    const code = await provider.getCode(tx.to);
                    if (code !== '0x') {
                        await this.markAsContract(tx.to, subnet);
                    }
                }
            }

            console.log(`Processed ${block.transactions.length} transactions in block ${blockNumber}`);

        } catch (err) {
            console.error(`Error processing block ${blockNumber} on ${subnet}:`, err);
        }
    }

    // Fonction principale d'indexation
    async startIndexing() {
        try {
            console.log('Starting wallet indexing...');
            
            // Indexer chaque subnet en parallèle
            await Promise.all(Object.entries(this.providers).map(async ([subnet, provider]) => {
                while (true) {
                    try {
                        // Récupérer le dernier bloc
                        const latestBlock = await provider.getBlockNumber();
                        
                        // Récupérer le dernier bloc indexé pour ce subnet
                        const lastIndexed = await db.get(
                            `SELECT MAX(last_active_timestamp) as last_block 
                             FROM active_wallets 
                             WHERE subnet = ?`,
                            [subnet]
                        );
                        
                        // Commencer 100 blocs en arrière si c'est la première fois
                        const startBlock = lastIndexed?.last_block 
                            ? await this.getBlockNumberFromTimestamp(lastIndexed.last_block, subnet)
                            : latestBlock - 100;
                        
                        console.log(`Indexing ${subnet} from block ${startBlock} to ${latestBlock}`);
                        
                        // Traiter les blocs
                        for (let i = startBlock + 1; i <= latestBlock; i++) {
                            await this.processBlock(i, subnet);
                        }
                        
                        // Attendre 10 secondes avant le prochain cycle
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        
                    } catch (err) {
                        console.error(`Error in ${subnet} indexing cycle:`, err);
                        // Attendre 30 secondes en cas d'erreur
                        await new Promise(resolve => setTimeout(resolve, 30000));
                    }
                }
            }));
            
        } catch (err) {
            console.error('Error in indexing process:', err);
        }
    }

    // Utilitaire pour convertir un timestamp en numéro de bloc
    async getBlockNumberFromTimestamp(timestamp, subnet) {
        try {
            const provider = this.providers[subnet];
            let left = 0;
            let right = await provider.getBlockNumber();
            
            while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                const block = await provider.getBlock(mid);
                
                if (!block) {
                    right = mid - 1;
                    continue;
                }
                
                if (block.timestamp === timestamp) {
                    return mid;
                }
                
                if (block.timestamp < timestamp) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }
            
            return left;
            
        } catch (err) {
            console.error(`Error getting block number from timestamp:`, err);
            return 0;
        }
    }

    // Obtenir des statistiques sur les wallets actifs
    async getWalletStats(subnet = null, minTransactions = 1) {
        const query = `
            SELECT 
                subnet,
                COUNT(*) as total_wallets,
                COUNT(CASE WHEN is_contract = 1 THEN 1 END) as contract_wallets,
                COUNT(CASE WHEN is_contract = 0 THEN 1 END) as eoa_wallets,
                AVG(transaction_count) as avg_transactions,
                MAX(transaction_count) as max_transactions
            FROM active_wallets
            WHERE transaction_count >= ?
            ${subnet ? 'AND subnet = ?' : ''}
            GROUP BY subnet
        `;
        
        const params = [minTransactions];
        if (subnet) params.push(subnet);
        
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

// Démarrer l'indexeur si le script est exécuté directement
if (require.main === module) {
    const indexer = new WalletIndexer();
    indexer.startIndexing().catch(console.error);
}

module.exports = WalletIndexer;
