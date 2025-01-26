const ethers = require('ethers');
const db = require('./database');
require('dotenv').config();

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUBNET_RPC_URLS = JSON.parse(process.env.SUBNET_RPC_URLS || '{}');

// Créer le provider principal
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Fonction pour détecter si une transaction est un déploiement de contrat
async function isContractDeployment(tx) {
    // Un déploiement de contrat n'a pas d'adresse de destination
    if (tx.to !== null) {
        return false;
    }

    try {
        // Récupérer le reçu de la transaction pour avoir l'adresse du contrat créé
        const receipt = await provider.getTransactionReceipt(tx.hash);
        return receipt && receipt.contractAddress;
    } catch (err) {
        console.error(`Error checking contract deployment for tx ${tx.hash}:`, err);
        return false;
    }
}

// Fonction pour récupérer le bytecode de déploiement
async function getDeploymentBytecode(tx) {
    try {
        // Récupérer la transaction complète
        const fullTx = await provider.getTransaction(tx.hash);
        return fullTx.data;
    } catch (err) {
        console.error(`Error getting deployment bytecode for tx ${tx.hash}:`, err);
        return null;
    }
}

// Fonction pour sauvegarder un déploiement de contrat
async function saveContractDeployment(deployment) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO contract_deployments (
                contract_address,
                deployer_address,
                deployment_tx_hash,
                bytecode,
                timestamp,
                block_number,
                subnet
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            deployment.contract_address,
            deployment.deployer_address,
            deployment.deployment_tx_hash,
            deployment.bytecode,
            deployment.timestamp,
            deployment.block_number,
            deployment.subnet,
            (err) => {
                if (err) {
                    console.error(`Error saving contract deployment ${deployment.contract_address}:`, err);
                    reject(err);
                } else {
                    console.log(`Saved contract deployment at ${deployment.contract_address}`);
                    resolve();
                }
            }
        );

        stmt.finalize();
    });
}

// Fonction pour analyser un bloc
async function processBlock(blockNumber, subnet = 'C-Chain') {
    try {
        console.log(`Processing block ${blockNumber} on ${subnet}...`);
        
        // Récupérer le bloc avec toutes ses transactions
        const block = await provider.getBlock(blockNumber, true);
        if (!block) {
            console.error(`Block ${blockNumber} not found`);
            return;
        }

        // Parcourir toutes les transactions
        for (const tx of block.transactions) {
            if (await isContractDeployment(tx)) {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                const bytecode = await getDeploymentBytecode(tx);
                
                // Créer l'objet de déploiement
                const deployment = {
                    contract_address: receipt.contractAddress,
                    deployer_address: tx.from,
                    deployment_tx_hash: tx.hash,
                    bytecode: bytecode,
                    timestamp: block.timestamp,
                    block_number: blockNumber,
                    subnet: subnet
                };

                // Sauvegarder le déploiement
                await saveContractDeployment(deployment);
                console.log(`Found contract deployment at ${receipt.contractAddress}`);
            }
        }

    } catch (err) {
        console.error(`Error processing block ${blockNumber}:`, err);
    }
}

// Fonction principale d'indexation
async function indexContractDeployments() {
    try {
        console.log('Starting contract indexing cycle...');
        
        // Récupérer le dernier bloc
        const latestBlock = await provider.getBlockNumber();
        console.log(`Latest block: ${latestBlock}`);
        
        // Récupérer le dernier bloc indexé
        const lastIndexed = await db.get(
            'SELECT MAX(block_number) as last_block FROM contract_deployments WHERE subnet = ?',
            ['C-Chain']
        );
        
        const startBlock = (lastIndexed?.last_block || latestBlock - 100) + 1;
        console.log(`Starting from block ${startBlock}`);
        
        // Indexer les blocs
        for (let i = startBlock; i <= latestBlock; i++) {
            await processBlock(i);
            if (i % 10 === 0) {
                console.log(`Processed up to block ${i}`);
            }
        }
        
        console.log('Contract indexing cycle completed');
        
    } catch (err) {
        console.error('Error in contract indexing cycle:', err);
    }
    
    // Planifier le prochain cycle
    setTimeout(indexContractDeployments, 30000);
}

// S'assurer que la table existe
db.run(`
    CREATE TABLE IF NOT EXISTS contract_deployments (
        contract_address TEXT PRIMARY KEY,
        deployer_address TEXT,
        deployment_tx_hash TEXT,
        bytecode TEXT,
        timestamp INTEGER,
        block_number INTEGER,
        subnet TEXT,
        verified BOOLEAN DEFAULT 0
    )
`, (err) => {
    if (err) {
        console.error('Error creating contract_deployments table:', err);
        process.exit(1);
    }
    
    // Démarrer l'indexeur
    console.log('Starting contract indexer...');
    indexContractDeployments().catch(console.error);
});
