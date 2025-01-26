const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialisation de la base de données
async function initDb() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                hash VARCHAR(66) PRIMARY KEY,
                from_address VARCHAR(42),
                to_address VARCHAR(42),
                value TEXT,
                subnet VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
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
