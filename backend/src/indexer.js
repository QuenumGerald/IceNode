const axios = require('axios');
const { getDb } = require('./db');

// Configuration en dur
const RPC_URLS = {
    'mainnet': 'https://avalanche-c-chain-rpc.publicnode.com',
    'dfk': 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc',
    'swimmer': 'https://subnets.avax.network/swimmer/mainnet/rpc',
    'dexalot': 'https://subnets.avax.network/dexalot/mainnet/rpc'
};

async function fetchBlockTransactions(rpcUrl, subnet) {
    try {
        console.log(`[${new Date().toISOString()}] Fetching transactions from ${subnet || 'C-Chain'} (${rpcUrl})`);

        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_blockNumber',
            params: []
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        console.log(`[${new Date().toISOString()}] Got block number: ${response.data.result}`);
        
        const blockNumber = parseInt(response.data.result, 16);
        console.log(`[${new Date().toISOString()}] Parsed block number: ${blockNumber}`);

        const transactions = [];
        const startBlock = Math.max(1, blockNumber - 10);

        for (let i = startBlock; i <= blockNumber; i++) {
            console.log(`[${new Date().toISOString()}] Fetching block ${i}/${blockNumber}`);
            try {
                const blockResponse = await axios.post(rpcUrl, {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getBlockByNumber',
                    params: [`0x${i.toString(16)}`, true]
                }, {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (blockResponse.data.result && blockResponse.data.result.transactions) {
                    transactions.push(...blockResponse.data.result.transactions);
                }
            } catch (blockError) {
                console.error(`[${new Date().toISOString()}] Error fetching block ${i}: ${blockError.message}`);
                continue;
            }
        }

        console.log(`[${new Date().toISOString()}] Found ${transactions.length} transactions`);
        
        // Sauvegarde en DB
        const db = await getDb();
        const client = await db.connect();

        try {
            await client.query('BEGIN');
            
            const insertQuery = `
                INSERT INTO transactions (hash, from_address, to_address, value, subnet)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (hash) DO UPDATE SET
                    from_address = EXCLUDED.from_address,
                    to_address = EXCLUDED.to_address,
                    value = EXCLUDED.value,
                    subnet = EXCLUDED.subnet
            `;

            for (const tx of transactions) {
                try {
                    await client.query(insertQuery, [
                        tx.hash,
                        tx.from,
                        tx.to,
                        tx.value,
                        subnet || 'mainnet'
                    ]);
                } catch (dbError) {
                    console.error(`[${new Date().toISOString()}] DB Error for tx ${tx.hash}: ${dbError.message}`);
                }
            }

            await client.query('COMMIT');
            console.log(`[${new Date().toISOString()}] Successfully saved transactions to DB`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
        return transactions;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in fetchBlockTransactions for ${subnet || 'C-Chain'}: ${error.message}`);
        console.error(error.stack);
        throw error;
    }
}

async function indexAllChains() {
    console.log('Starting indexing cycle...');

    // Indexer C-Chain
    await fetchBlockTransactions(RPC_URLS['mainnet']);

    // Indexer les subnets
    for (const [subnet, url] of Object.entries(RPC_URLS)) {
        if (subnet !== 'mainnet') {
            await fetchBlockTransactions(url, subnet);
        }
    }

    console.log('Finished indexing cycle');
}

async function startIndexing() {
    console.log('Indexer started');

    while (true) {
        try {
            await indexAllChains();
            await new Promise(resolve => setTimeout(resolve, 10000)); // Attendre 10 secondes
        } catch (error) {
            console.error('Error in indexing cycle:', error);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes en cas d'erreur
        }
    }
}

module.exports = {
    startIndexing
};
