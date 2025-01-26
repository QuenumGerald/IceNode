const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/icenode.db');
const DB_DIR = path.dirname(DB_PATH);
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 secondes

// S'assurer que le dossier data existe
if (!fs.existsSync(DB_DIR)) {
    console.log('Creating database directory:', DB_DIR);
    fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('Using database:', DB_PATH);

// Créer la connexion à la base de données
let db = null;
let connectionAttempts = 0;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToDatabase(retry = true) {
    return new Promise(async (resolve, reject) => {
        if (db) {
            console.log('Reusing existing database connection');
            return resolve(db);
        }

        const attemptConnection = () => {
            console.log(`Creating new database connection (attempt ${connectionAttempts + 1}/${MAX_RETRIES})`);
            db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
                if (err) {
                    console.error('Error connecting to database:', err);
                    connectionAttempts++;
                    
                    if (retry && connectionAttempts < MAX_RETRIES) {
                        console.log(`Retrying in ${RETRY_DELAY}ms...`);
                        await sleep(RETRY_DELAY);
                        attemptConnection();
                    } else {
                        db = null;
                        connectionAttempts = 0;
                        reject(err);
                    }
                } else {
                    console.log('Connected to database successfully');
                    connectionAttempts = 0;
                    
                    // Handle database errors
                    db.on('error', async (err) => {
                        console.error('Database error:', err);
                        db = null;
                        // Try to reconnect on error
                        try {
                            await connectToDatabase();
                        } catch (reconnectErr) {
                            console.error('Failed to reconnect:', reconnectErr);
                        }
                    });
                    
                    resolve(db);
                }
            });
        };

        attemptConnection();
    });
}

// Initialize database tables
async function initDatabase() {
    try {
        await connectToDatabase();
        
        // Enable foreign keys
        await asyncRunWithRetry('PRAGMA foreign_keys = ON');
        
        // Create tables if they don't exist
        await asyncRunWithRetry(`
            CREATE TABLE IF NOT EXISTS transactions (
                hash TEXT PRIMARY KEY,
                blockNumber INTEGER,
                "from" TEXT,
                "to" TEXT,
                value TEXT,
                timestamp INTEGER,
                subnet TEXT
            )
        `);
        
        // Add indexes for better performance
        await asyncRunWithRetry('CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC)');
        await asyncRunWithRetry('CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions("from")');
        await asyncRunWithRetry('CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions("to")');
        
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
}

// Promisify database functions with retry
async function asyncRunWithRetry(sql, params = [], retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await connectToDatabase();
            return await asyncRun(sql, params);
        } catch (err) {
            if (i === retries - 1) throw err;
            console.error(`Error in asyncRunWithRetry (attempt ${i + 1}/${retries}):`, err);
            await sleep(RETRY_DELAY);
        }
    }
}

async function asyncAllWithRetry(sql, params = [], retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await connectToDatabase();
            return await asyncAll(sql, params);
        } catch (err) {
            if (i === retries - 1) throw err;
            console.error(`Error in asyncAllWithRetry (attempt ${i + 1}/${retries}):`, err);
            await sleep(RETRY_DELAY);
        }
    }
}

async function asyncGetWithRetry(sql, params = [], retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await connectToDatabase();
            return await asyncGet(sql, params);
        } catch (err) {
            if (i === retries - 1) throw err;
            console.error(`Error in asyncGetWithRetry (attempt ${i + 1}/${retries}):`, err);
            await sleep(RETRY_DELAY);
        }
    }
}

// Base database functions
function asyncRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database connection not available'));
        }
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function asyncAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database connection not available'));
        }
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function asyncGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject(new Error('Database connection not available'));
        }
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Initialize database on module load
initDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Export functions
module.exports = {
    db: () => db,
    connectToDatabase,
    initDatabase,
    asyncRun: asyncRunWithRetry,
    asyncAll: asyncAllWithRetry,
    asyncGet: asyncGetWithRetry
};
