require('dotenv').config();
const axios = require('axios');
const db = require('./database');

// Configuration des subnets - Utiliser l'URL de l'env pour C-Chain
const SUBNETS = {
    'C-Chain': process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    'DFK': 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc',
    'Swimmer': 'https://subnets.avax.network/swimmer/mainnet/rpc',
    'Dexalot': 'https://subnets.avax.network/dexalot/mainnet/rpc'
};

// Fonction utilitaire pour convertir les valeurs hex en nombre
function hexToNumber(hex) {
    if (!hex) return '0';
    try {
        return (BigInt(hex) / BigInt(1e18)).toString();
    } catch (err) {
        console.error('Error converting hex to number:', hex, err);
        return '0';
    }
}

async function fetchBlockTransactions(rpcUrl, subnet, blockNumber) {
    try {
        console.log(`[${subnet}] Fetching block ${blockNumber || 'latest'}...`);
        
        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBlockByNumber',
            params: [blockNumber || 'latest', true]
        });

        if (!response.data || !response.data.result) {
            console.error(`No block data received from ${subnet}`);
            return null;
        }

        const block = response.data.result;
        if (!block || !block.transactions) {
            console.error(`Invalid block data from ${subnet}`);
            return null;
        }

        const transactions = block.transactions;
        console.log(`[${subnet}] Processing ${transactions.length} transactions...`);

        // Utiliser une promesse pour s'assurer que toutes les transactions sont insérées
        await new Promise((resolve, reject) => {
            const stmt = db.prepare(
                `INSERT OR IGNORE INTO transactions 
                (hash, from_address, to_address, amount, timestamp, subnet, block_number) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`
            );

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                transactions.forEach((tx) => {
                    try {
                        stmt.run(
                            tx.hash,
                            tx.from || null,
                            tx.to || null,
                            hexToNumber(tx.value),
                            parseInt(block.timestamp, 16),
                            subnet,
                            parseInt(block.number, 16)
                        );
                    } catch (err) {
                        console.error(`Error processing transaction ${tx.hash}:`, err);
                    }
                });

                db.run('COMMIT', (err) => {
                    stmt.finalize();
                    if (err) {
                        console.error('Error committing transaction:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        console.log(`[${subnet}] Successfully indexed ${transactions.length} transactions from block ${parseInt(block.number, 16)}`);
        return parseInt(block.number, 16);
    } catch (err) {
        console.error(`Error fetching transactions from ${subnet}:`, err.message);
        return null;
    }
}

async function indexAllSubnets() {
    const blockNumbers = {};

    for (const [subnet, rpcUrl] of Object.entries(SUBNETS)) {
        try {
            console.log(`\nProcessing subnet: ${subnet}`);
            const latestBlock = await fetchBlockTransactions(rpcUrl, subnet);
            
            if (latestBlock) {
                blockNumbers[subnet] = latestBlock;
                
                // Récupérer aussi les 10 derniers blocks pour avoir plus de données
                for (let i = 1; i <= 10; i++) {
                    const blockNumber = '0x' + (latestBlock - i).toString(16);
                    await fetchBlockTransactions(rpcUrl, subnet, blockNumber);
                }
            }
        } catch (err) {
            console.error(`Error processing ${subnet}:`, err.message);
        }
    }

    return blockNumbers;
}

// Fonction principale qui s'exécute en continu
async function runIndexer() {
    console.log('Starting subnet indexer...');
    console.log('Using RPC URLs:', SUBNETS);
    
    while (true) {
        try {
            await indexAllSubnets();
            // Attendre 12 secondes (temps moyen d'un bloc Avalanche)
            console.log('\nWaiting 12 seconds before next iteration...');
            await new Promise(resolve => setTimeout(resolve, 12000));
        } catch (err) {
            console.error('Error in main indexer loop:', err);
            // Attendre 30 secondes en cas d'erreur avant de réessayer
            console.log('\nError occurred, waiting 30 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
}

// Démarrer l'indexeur
if (require.main === module) {
    runIndexer().catch(console.error);
}

module.exports = {
    indexAllSubnets,
    fetchBlockTransactions
};
