const ethers = require('ethers');
const db = require('./database');
require('dotenv').config();

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUBNET_RPC_URLS = JSON.parse(process.env.SUBNET_RPC_URLS || '{}');

// ABI commune pour les événements standard
const COMMON_EVENTS_ABI = [
    // ERC20
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    // ERC721
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
    // DEX
    "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
    "event Mint(address indexed sender, uint amount0, uint amount1)",
    "event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)",
    // Staking
    "event Staked(address indexed user, uint256 amount)",
    "event Withdrawn(address indexed user, uint256 amount)",
    "event RewardPaid(address indexed user, uint256 reward)"
];

class EventIndexer {
    constructor(options = {}) {
        this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        this.contracts = new Map(); // Map pour stocker les contrats surveillés
        this.commonInterface = new ethers.utils.Interface(COMMON_EVENTS_ABI);
        
        // Créer la table des événements si elle n'existe pas
        this.initDatabase();
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS contract_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contract_address TEXT,
                    event_name TEXT,
                    parameters TEXT,
                    block_number INTEGER,
                    transaction_hash TEXT,
                    log_index INTEGER,
                    timestamp INTEGER,
                    subnet TEXT,
                    UNIQUE(transaction_hash, log_index)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating events table:', err);
                    reject(err);
                } else {
                    console.log('Events table ready');
                    resolve();
                }
            });
        });
    }

    // Ajouter un contrat à surveiller
    async addContract(address, abi = COMMON_EVENTS_ABI) {
        try {
            const contract = new ethers.Contract(address, abi, this.provider);
            this.contracts.set(address.toLowerCase(), {
                contract,
                interface: new ethers.utils.Interface(abi)
            });
            console.log(`Added contract ${address} to watch list`);
        } catch (err) {
            console.error(`Error adding contract ${address}:`, err);
        }
    }

    // Retirer un contrat de la surveillance
    removeContract(address) {
        this.contracts.delete(address.toLowerCase());
        console.log(`Removed contract ${address} from watch list`);
    }

    // Sauvegarder un événement dans la base de données
    async saveEvent(event, subnet = 'C-Chain') {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO contract_events (
                    contract_address,
                    event_name,
                    parameters,
                    block_number,
                    transaction_hash,
                    log_index,
                    timestamp,
                    subnet
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const parameters = JSON.stringify(event.args || {});

            stmt.run(
                event.address,
                event.event || 'Unknown',
                parameters,
                event.blockNumber,
                event.transactionHash,
                event.logIndex,
                event.timestamp || Math.floor(Date.now() / 1000),
                subnet,
                (err) => {
                    if (err) {
                        console.error(`Error saving event:`, err);
                        reject(err);
                    } else {
                        console.log(`Saved event ${event.event} from ${event.address}`);
                        resolve();
                    }
                }
            );

            stmt.finalize();
        });
    }

    // Traiter un événement
    async processEvent(event) {
        try {
            const contract = this.contracts.get(event.address.toLowerCase());
            if (!contract) return; // Ignorer les événements des contrats non surveillés

            // Récupérer le bloc pour avoir le timestamp
            const block = await this.provider.getBlock(event.blockNumber);
            event.timestamp = block.timestamp;

            // Essayer de décoder l'événement avec l'interface du contrat
            try {
                const decodedEvent = contract.interface.parseLog(event);
                event.event = decodedEvent.name;
                event.args = decodedEvent.args;
            } catch (err) {
                // Si on ne peut pas décoder avec l'ABI du contrat, essayer avec l'ABI commune
                try {
                    const decodedEvent = this.commonInterface.parseLog(event);
                    event.event = decodedEvent.name;
                    event.args = decodedEvent.args;
                } catch (err) {
                    // Si on ne peut toujours pas décoder, enregistrer comme événement inconnu
                    event.event = 'Unknown';
                    event.args = { data: event.data, topics: event.topics };
                }
            }

            // Sauvegarder l'événement
            await this.saveEvent(event);

        } catch (err) {
            console.error(`Error processing event:`, err);
        }
    }

    // Démarrer l'écoute des événements
    async start() {
        console.log('Starting event indexer...');
        
        // Écouter tous les événements des contrats surveillés
        this.provider.on('logs', async (event) => {
            if (this.contracts.has(event.address.toLowerCase())) {
                await this.processEvent(event);
            }
        });

        // Écouter les nouveaux blocs pour le timestamp
        this.provider.on('block', async (blockNumber) => {
            console.log(`New block: ${blockNumber}`);
        });
    }

    // Arrêter l'écoute des événements
    async stop() {
        console.log('Stopping event indexer...');
        this.provider.removeAllListeners();
    }

    // Récupérer les événements historiques
    async getHistoricalEvents(startBlock, endBlock) {
        console.log(`Fetching historical events from block ${startBlock} to ${endBlock}...`);
        
        for (const [address, contract] of this.contracts.entries()) {
            const filter = {
                address: address,
                fromBlock: startBlock,
                toBlock: endBlock
            };

            try {
                const events = await this.provider.getLogs(filter);
                console.log(`Found ${events.length} events for contract ${address}`);
                
                for (const event of events) {
                    await this.processEvent(event);
                }
            } catch (err) {
                console.error(`Error fetching historical events for ${address}:`, err);
            }
        }
    }
}

// Exemple d'utilisation
async function main() {
    // Créer l'indexeur
    const indexer = new EventIndexer();

    // Ajouter quelques contrats à surveiller (exemples)
    const USDC_ADDRESS = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
    const WAVAX_ADDRESS = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
    
    await indexer.addContract(USDC_ADDRESS);
    await indexer.addContract(WAVAX_ADDRESS);

    // Démarrer l'indexeur
    await indexer.start();

    // Récupérer les événements des 1000 derniers blocs
    const latestBlock = await indexer.provider.getBlockNumber();
    await indexer.getHistoricalEvents(latestBlock - 1000, latestBlock);

    // Gérer l'arrêt propre
    process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await indexer.stop();
        process.exit(0);
    });
}

// Démarrer si le script est exécuté directement
if (require.main === module) {
    main().catch(console.error);
}

module.exports = EventIndexer;
