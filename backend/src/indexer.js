const axios = require('axios');
const { getDb } = require('./db');
const web3 = require('web3');
const RLP = require('rlp');

// Configuration en dur
const RPC_URLS = {
    'mainnet': 'https://avalanche-c-chain-rpc.publicnode.com',
    'dfk': 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc',
    'swimmer': 'https://subnets.avax.network/swimmer/mainnet/rpc',
    'dexalot': 'https://subnets.avax.network/dexalot/mainnet/rpc'
};

// Nombre de blocs à indexer par batch
const BLOCKS_PER_BATCH = 100;
// Nombre maximum de blocs à indexer
const MAX_BLOCKS = 10000;

async function getContractCode(rpcUrl, address) {
    try {
        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getCode',
            params: [address, 'latest']
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        return response.data.result;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error getting contract code for ${address}: ${error.message}`);
        return null;
    }
}

async function getContractABI(address) {
    try {
        const response = await axios.get(`https://api.snowtrace.io/api/v1/contract/${address}/abi`, {
            timeout: 10000
        });
        return response.data.result;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error getting contract ABI for ${address}: ${error.message}`);
        return null;
    }
}

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
        const startBlock = Math.max(1, blockNumber - MAX_BLOCKS);

        for (let currentBlock = blockNumber; currentBlock > startBlock; currentBlock -= BLOCKS_PER_BATCH) {
            const batchStart = Math.max(startBlock, currentBlock - BLOCKS_PER_BATCH);
            console.log(`[${new Date().toISOString()}] Fetching blocks ${batchStart} to ${currentBlock}`);

            const batchPromises = [];
            for (let i = batchStart; i <= currentBlock; i++) {
                batchPromises.push(
                    axios.post(rpcUrl, {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'eth_getBlockByNumber',
                        params: [`0x${i.toString(16)}`, true]
                    }, {
                        timeout: 10000,
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    }).catch(error => {
                        console.error(`[${new Date().toISOString()}] Error fetching block ${i}: ${error.message}`);
                        return null;
                    })
                );
            }

            const batchResults = await Promise.all(batchPromises);
            for (const response of batchResults) {
                if (response?.data?.result?.transactions) {
                    const txs = response.data.result.transactions;
                    for (const tx of txs) {
                        // Vérifier si c'est un contrat
                        if (tx.to === null || tx.to === '0x0000000000000000000000000000000000000000') {
                            // C'est un déploiement de contrat
                            tx.is_contract_creation = true;
                            tx.contract_address = '0x' + web3.utils.sha3(RLP.encode([tx.from, tx.nonce])).slice(26);
                        } else {
                            // Vérifier si l'adresse de destination est un contrat
                            const code = await getContractCode(rpcUrl, tx.to);
                            tx.is_contract = code && code !== '0x';
                            if (tx.is_contract) {
                                tx.contract_code = code;
                                tx.contract_abi = await getContractABI(tx.to);
                            }
                        }
                    }
                    transactions.push(...txs);
                }
            }

            // Sauvegarde intermédiaire en DB tous les 1000 blocs
            if (transactions.length >= 1000) {
                await saveTransactions(transactions, subnet);
                transactions.length = 0; // Vider le tableau après la sauvegarde
            }

            // Petite pause pour éviter de surcharger l'API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Sauvegarde finale des transactions restantes
        if (transactions.length > 0) {
            await saveTransactions(transactions, subnet);
        }

        console.log(`[${new Date().toISOString()}] Finished indexing ${subnet}`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in fetchBlockTransactions: ${error.message}`);
        throw error;
    }
}

async function saveTransactions(transactions, subnet) {
    const db = await getDb();
    const client = await db.connect();

    try {
        await client.query('BEGIN');
        
        const insertQuery = `
            INSERT INTO transactions (
                hash, 
                from_address, 
                to_address, 
                value, 
                subnet,
                is_contract_creation,
                is_contract,
                contract_address,
                contract_code,
                contract_abi
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (hash) DO UPDATE SET
                from_address = EXCLUDED.from_address,
                to_address = EXCLUDED.to_address,
                value = EXCLUDED.value,
                subnet = EXCLUDED.subnet,
                is_contract_creation = EXCLUDED.is_contract_creation,
                is_contract = EXCLUDED.is_contract,
                contract_address = EXCLUDED.contract_address,
                contract_code = EXCLUDED.contract_code,
                contract_abi = EXCLUDED.contract_abi
        `;

        for (const tx of transactions) {
            try {
                await client.query(insertQuery, [
                    tx.hash,
                    tx.from,
                    tx.to,
                    tx.value,
                    subnet || 'mainnet',
                    tx.is_contract_creation || false,
                    tx.is_contract || false,
                    tx.contract_address || null,
                    tx.contract_code || null,
                    tx.contract_abi || null
                ]);
            } catch (dbError) {
                console.error(`[${new Date().toISOString()}] DB Error for tx ${tx.hash}: ${dbError.message}`);
            }
        }

        await client.query('COMMIT');
        console.log(`[${new Date().toISOString()}] Successfully saved ${transactions.length} transactions to DB`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function indexAllChains() {
    try {
        console.log(`[${new Date().toISOString()}] Starting indexing of all chains`);
        
        for (const [subnet, rpcUrl] of Object.entries(RPC_URLS)) {
            try {
                await fetchBlockTransactions(rpcUrl, subnet);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error indexing ${subnet}: ${error.message}`);
            }
        }
        
        console.log(`[${new Date().toISOString()}] Finished indexing all chains`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in indexAllChains: ${error.message}`);
    }
}

async function startIndexing() {
    console.log(`[${new Date().toISOString()}] Starting indexer`);
    
    // Premier indexage
    await indexAllChains();
    
    // Indexage périodique toutes les 5 minutes
    setInterval(async () => {
        await indexAllChains();
    }, 5 * 60 * 1000);
}

module.exports = {
    startIndexing
};
