const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/icenode.db');
const DB_DIR = path.dirname(DB_PATH);

// S'assurer que le dossier data existe
if (!fs.existsSync(DB_DIR)) {
    console.log('Creating database directory:', DB_DIR);
    fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('Using database:', DB_PATH);

// Créer la connexion à la base de données
let db = null;

function connectToDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            console.log('Reusing existing database connection');
            return resolve(db);
        }

        console.log('Creating new database connection');
        db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
            } else {
                console.log('Connected to database');
                resolve(db);
            }
        });

        // Handle database errors
        db.on('error', (err) => {
            console.error('Database error:', err);
            db = null; // Reset connection on error
        });
    });
}

// Initialize database tables
async function initDatabase() {
    try {
        await connectToDatabase();
        
        // Enable foreign keys
        await asyncRun('PRAGMA foreign_keys = ON');
        
        // Create tables if they don't exist
        await asyncRun(`
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
        
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
}

// Promisify database functions
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
    asyncRun,
    asyncAll,
    asyncGet
};
