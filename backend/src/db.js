const { Pool } = require('pg');

// Configuration du pool avec des timeouts et retries
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'egmMpvjpbAXVIZTAlWsGSSsWcVSQPgtE',
    host: process.env.PGHOST || 'monorail.proxy.rlwy.net',
    port: process.env.PGPORT || 42069,
    database: process.env.PGDATABASE || 'railway',
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20
});

// Fonction pour attendre avec un délai
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour tenter une connexion avec retries
async function connectWithRetry(maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Tentative de connexion à PostgreSQL (${i + 1}/${maxRetries})...`);
            console.log('Configuration de connexion:', {
                host: process.env.PGHOST || 'monorail.proxy.rlwy.net',
                port: process.env.PGPORT || 42069,
                database: process.env.PGDATABASE || 'railway',
                user: process.env.PGUSER || 'postgres'
            });
            
            const client = await pool.connect();
            console.log('Connexion à PostgreSQL établie avec succès');
            return client;
        } catch (error) {
            console.error(`Échec de la connexion (tentative ${i + 1}/${maxRetries}):`, error.message);
            if (i < maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, i), 10000);
                console.log(`Nouvelle tentative dans ${delay/1000} secondes...`);
                await wait(delay);
            } else {
                throw new Error(`Impossible de se connecter à PostgreSQL après ${maxRetries} tentatives`);
            }
        }
    }
}

// Initialisation de la base de données
async function initDb() {
    let client;
    try {
        client = await connectWithRetry();
        
        console.log('Création de la table transactions...');
        await client.query('DROP TABLE IF EXISTS transactions');
        
        await client.query(`
            CREATE TABLE transactions (
                hash VARCHAR(66) PRIMARY KEY,
                from_address VARCHAR(42),
                to_address VARCHAR(42),
                value TEXT,
                subnet VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Création de l\'index sur subnet...');
        await client.query('CREATE INDEX idx_transactions_subnet ON transactions(subnet)');
        
        console.log('Base de données initialisée avec succès');
    } catch (err) {
        console.error('Erreur lors de l\'initialisation de la base de données:', err);
        throw err;
    } finally {
        if (client) {
            console.log('Libération de la connexion...');
            client.release();
        }
    }
}

// Fonction pour obtenir une connexion du pool
async function getDb() {
    return pool;
}

// Gestion des erreurs du pool
pool.on('error', (err) => {
    console.error('Erreur inattendue du pool PostgreSQL:', err);
});

module.exports = {
    initDb,
    getDb
};
