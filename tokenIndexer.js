require('dotenv').config();
const { ethers } = require('ethers');
const db = require('./database');

const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL;
const provider = new ethers.providers.JsonRpcProvider(AVALANCHE_RPC_URL);

// ABI minimale pour les tokens ERC20
const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

async function fetchTokenData(tokenAddress) {
    try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        
        const [name, symbol, decimals, totalSupply] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
            contract.totalSupply()
        ]);

        await db.run(
            `INSERT OR REPLACE INTO tokens (address, name, symbol, total_supply, decimals) 
             VALUES (?, ?, ?, ?, ?)`,
            [tokenAddress, name, symbol, totalSupply.toString(), decimals]
        );

        console.log(`Indexed token: ${symbol} (${name})`);
        return { name, symbol, decimals, totalSupply };
    } catch (err) {
        console.error(`Error fetching token data for ${tokenAddress}:`, err.message);
        return null;
    }
}

async function findNewTokens() {
    try {
        const latestBlock = await provider.getBlockNumber();
        const startBlock = latestBlock - 1000; // Chercher dans les 1000 derniers blocs

        // Filtrer les événements Transfer qui peuvent indiquer des tokens
        const filter = {
            topics: [
                ethers.utils.id("Transfer(address,address,uint256)")
            ],
            fromBlock: startBlock,
            toBlock: latestBlock
        };

        const logs = await provider.getLogs(filter);
        const uniqueContracts = new Set(logs.map(log => log.address));

        for (const contractAddress of uniqueContracts) {
            await fetchTokenData(contractAddress);
        }

        console.log(`Finished scanning blocks ${startBlock} to ${latestBlock}`);
    } catch (err) {
        console.error('Error finding new tokens:', err);
    }
}

// Fonction principale qui s'exécute toutes les minutes
async function main() {
    console.log('Starting token indexer...');
    while (true) {
        await findNewTokens();
        await new Promise(resolve => setTimeout(resolve, 60000)); // Attendre 1 minute
    }
}

// Démarrer l'indexeur si le script est exécuté directement
if (require.main === module) {
    main().catch(console.error);
}
