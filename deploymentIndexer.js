require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./database');

class DeploymentIndexer {
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL);
        this.lastProcessedBlock = 0;
    }

    async isContract(address) {
        try {
            const code = await this.provider.getCode(address);
            return code !== '0x';
        } catch (error) {
            console.error(`Error checking if address ${address} is contract:`, error);
            return false;
        }
    }

    async processTransaction(tx, timestamp) {
        try {
            const receipt = await this.provider.getTransactionReceipt(tx.hash);
            if (!receipt || !receipt.contractAddress) return;

            // Vérifier que c'est bien un contrat
            const isContract = await this.isContract(receipt.contractAddress);
            if (!isContract) return;

            console.log(`Found contract deployment at ${receipt.contractAddress}`);

            // Récupérer le bytecode de déploiement
            const deploymentBytecode = tx.data;

            // Sauvegarder dans la base de données
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO contract_deployments 
                    (contract_address, deployer_address, deployment_tx_hash, block_number, timestamp, bytecode) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        receipt.contractAddress,
                        tx.from,
                        tx.hash,
                        receipt.blockNumber,
                        timestamp,
                        deploymentBytecode
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log(`Indexed contract deployment: ${receipt.contractAddress} by ${tx.from}`);
        } catch (error) {
            console.error(`Error processing transaction ${tx.hash}:`, error);
        }
    }

    async processBlock(blockNumber) {
        try {
            const block = await this.provider.getBlock(blockNumber, true);
            if (!block) return;

            console.log(`Processing block ${blockNumber} with ${block.transactions.length} transactions`);

            // Filtrer les transactions qui créent des contrats (to est null)
            const deploymentTxs = block.transactions.filter(tx => !tx.to);

            for (const tx of deploymentTxs) {
                await this.processTransaction(tx, block.timestamp);
            }

            this.lastProcessedBlock = blockNumber;
        } catch (error) {
            console.error(`Error processing block ${blockNumber}:`, error);
        }
    }

    async start() {
        console.log('Starting deployment indexer...');
        
        while (true) {
            try {
                const latestBlock = await this.provider.getBlockNumber();
                const startBlock = Math.max(this.lastProcessedBlock, latestBlock - 10);

                for (let i = startBlock + 1; i <= latestBlock; i++) {
                    await this.processBlock(i);
                }

                // Attendre 5 secondes avant de vérifier les nouveaux blocs
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                console.error('Error in main loop:', error);
                // En cas d'erreur, attendre 10 secondes avant de réessayer
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    // Méthode pour analyser un intervalle de blocs spécifique
    async processBlockRange(startBlock, endBlock) {
        console.log(`Processing block range from ${startBlock} to ${endBlock}`);
        
        for (let i = startBlock; i <= endBlock; i++) {
            await this.processBlock(i);
            if (i % 100 === 0) {
                console.log(`Processed ${i - startBlock} blocks out of ${endBlock - startBlock}`);
            }
        }
    }
}

// Démarrer l'indexeur si le script est exécuté directement
if (require.main === module) {
    const indexer = new DeploymentIndexer();
    
    // Si des arguments sont fournis, traiter une plage de blocs spécifique
    if (process.argv.length === 4) {
        const startBlock = parseInt(process.argv[2]);
        const endBlock = parseInt(process.argv[3]);
        indexer.processBlockRange(startBlock, endBlock).catch(console.error);
    } else {
        // Sinon, démarrer l'indexation continue
        indexer.start().catch(console.error);
    }
}
