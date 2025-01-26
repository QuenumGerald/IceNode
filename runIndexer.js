const fetchTransactions = require('./indexer');

async function runIndexer() {
    while (true) {
        await fetchTransactions();
        // Attendre 12 secondes (temps moyen d'un bloc Avalanche)
        await new Promise(resolve => setTimeout(resolve, 12000));
    }
}

runIndexer().catch(console.error);
