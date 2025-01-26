require('dotenv').config();
const axios = require('axios');
const db = require('./database');
const ethers = require('ethers');

// URLs en dur
const RPC_URL = 'https://api.avax.network/ext/bc/C/rpc';
const SUBNET_RPC_URLS = {
    'DFK': 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc',
    'Dexalot': 'https://subnets.avax.network/dexalot/mainnet/rpc'
};

console.log('Starting indexer with configuration:');
console.log('RPC_URL:', RPC_URL);
console.log('SUBNET_RPC_URLS:', SUBNET_RPC_URLS);

// Fonction pour convertir les valeurs hex en nombres
function hexToNumber(hex) {
    if (!hex) return 0;
    return parseInt(hex, 16);
}

async function fetchBlockTransactions(rpcUrl, subnet) {
    try {
        console.log(`Fetching transactions from ${subnet || 'C-Chain'} (${rpcUrl})`);
        
        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBlockByNumber',
            params: ['latest', true],
        }, {
            timeout: 10000 // 10 secondes timeout
        });

        if (!response.data || !response.data.result) {
            console.error(`No data received from ${subnet || 'C-Chain'}`);
            console.error('Response:', JSON.stringify(response.data, null, 2));
            return;
        }

        const block = response.data.result;
        const timestamp = hexToNumber(block.timestamp);
        const blockNumber = hexToNumber(block.number);

        console.log(`Processing block ${blockNumber} from ${subnet || 'C-Chain'} with ${block.transactions.length} transactions`);

        // Utiliser une transaction SQLite pour l'atomicité
        await db.asyncRun('BEGIN TRANSACTION');

        try {
            for (const tx of block.transactions) {
                await db.asyncRun(
                    `INSERT OR REPLACE INTO transactions (
                        hash, 
                        from_address, 
                        to_address, 
                        amount, 
                        timestamp, 
                        subnet,
                        block_number
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        tx.hash,
                        tx.from,
                        tx.to,
                        (hexToNumber(tx.value) / 1e18).toString(), // Convertir wei en AVAX
                        timestamp,
                        subnet || 'C-Chain',
                        blockNumber
                    ]
                );

                // Si c'est un déploiement de contrat (to est null)
                if (!tx.to && tx.creates) {
                    await db.asyncRun(
                        `INSERT OR REPLACE INTO contract_deployments (
                            contract_address,
                            deployment_tx_hash,
                            timestamp
                        ) VALUES (?, ?, ?)`,
                        [tx.creates, tx.hash, timestamp]
                    );
                }
            }

            await db.asyncRun('COMMIT');
            console.log(`Successfully indexed ${block.transactions.length} transactions from ${subnet || 'C-Chain'}`);
        } catch (err) {
            console.error(`Error during database operations for ${subnet || 'C-Chain'}:`, err);
            await db.asyncRun('ROLLBACK');
            throw err;
        }
    } catch (err) {
        console.error(`Error fetching transactions from ${subnet || 'C-Chain'}:`, err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

async function indexAllChains() {
    console.log('Starting indexing cycle...');
    
    // Indexer C-Chain
    await fetchBlockTransactions(RPC_URL);

    // Indexer les subnets
    for (const [subnet, url] of Object.entries(SUBNET_RPC_URLS)) {
        await fetchBlockTransactions(url, subnet);
    }
    
    console.log('Finished indexing cycle');
}

// Exécuter l'indexation toutes les 10 secondes
async function startIndexing() {
    console.log('Indexer started');
    
    while (true) {
        try {
            await indexAllChains();
        } catch (err) {
            console.error('Error in indexing cycle:', err);
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}

// Démarrer l'indexation
console.log('Starting indexer...');
startIndexing().catch(console.error);
