const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:egmMpvjpbAXVIZTAlWsGSSsWcVSQPgtE@postgres.railway.internal:5432/railway',
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

// Initialisation de la base de données
async function initDb() {
    const client = await pool.connect();
    try {
        // Supprime la table si elle existe
        await client.query('DROP TABLE IF EXISTS transactions');
        
        // Crée la table avec la nouvelle structure
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
        
        // Crée un index sur subnet pour des requêtes plus rapides
        await client.query('CREATE INDEX idx_transactions_subnet ON transactions(subnet)');
        
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Fonction pour obtenir une connexion
async function getDb() {
    return pool;
}

module.exports = {
    initDb,
    getDb
};
