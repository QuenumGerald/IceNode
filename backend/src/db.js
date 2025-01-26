const { Pool } = require('pg');

let pool = null;

// Fonction pour attendre avec un délai
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Nettoyage périodique de la base de données
async function cleanDatabase() {
    try {
        const client = await pool.connect();
        try {
            // On garde seulement les transactions des 2 dernières heures
            const twoHoursAgo = new Date();
            twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
            
            // Supprimer les anciennes transactions
            const result = await client.query(`
                DELETE FROM transactions 
                WHERE created_at < $1
                RETURNING COUNT(*)
            `, [twoHoursAgo]);
            
            console.log(`[${new Date().toISOString()}] Nettoyage BDD : ${result.rows[0].count} transactions supprimées`);
            
            // VACUUM pour récupérer l'espace disque
            await client.query('VACUUM FULL');
            console.log(`[${new Date().toISOString()}] VACUUM terminé`);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Erreur lors du nettoyage de la base de données:', err);
    }
}

// Fonction pour tenter une connexion avec retries
async function connectWithRetry(maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`[${new Date().toISOString()}] Tentative de connexion à PostgreSQL (${i + 1}/${maxRetries})...`);

            const client = await pool.connect();
            console.log(`[${new Date().toISOString()}] Connexion à PostgreSQL établie avec succès`);
            return client;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Échec de la connexion (tentative ${i + 1}/${maxRetries}):`, error.message);
            if (i < maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, i), 10000);
                console.log(`Nouvelle tentative dans ${delay / 1000} secondes...`);
                await wait(delay);
            } else {
                throw new Error(`Impossible de se connecter à PostgreSQL après ${maxRetries} tentatives`);
            }
        }
    }
}

// Initialisation de la base de données
async function initDb() {
    try {
        // Utilisation de l'URL de la base de données depuis les variables d'environnement
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/icenode',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        const client = await connectWithRetry();
        try {
            // Création de la table transactions avec les nouveaux champs
            await client.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    hash VARCHAR(66) PRIMARY KEY,
                    from_address VARCHAR(42) NOT NULL,
                    to_address VARCHAR(42),
                    value TEXT NOT NULL,
                    subnet VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    is_contract_creation BOOLEAN DEFAULT FALSE,
                    is_contract BOOLEAN DEFAULT FALSE,
                    contract_address VARCHAR(42),
                    contract_code TEXT,
                    contract_abi TEXT
                )
            `);

            // Index pour améliorer les performances des recherches
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
                CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
                CREATE INDEX IF NOT EXISTS idx_transactions_subnet ON transactions(subnet);
                CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
                CREATE INDEX IF NOT EXISTS idx_transactions_is_contract ON transactions(is_contract);
                CREATE INDEX IF NOT EXISTS idx_transactions_contract_address ON transactions(contract_address);
            `);

            console.log(`[${new Date().toISOString()}] Base de données initialisée avec succès`);

            // Premier nettoyage
            await cleanDatabase();

            // Planifier le nettoyage toutes les 2 heures
            setInterval(cleanDatabase, 2 * 60 * 60 * 1000);

        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Erreur lors de l\'initialisation de la base de données:', err);
        throw err;
    }
}

function getDb() {
    if (!pool) {
        throw new Error('La base de données n\'est pas initialisée');
    }
    return pool;
}

// Gestion des erreurs du pool
pool.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Erreur inattendue du pool PostgreSQL:`, err);
    process.exit(-1);
});

module.exports = {
    initDb,
    getDb,
    cleanDatabase
};
