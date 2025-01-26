const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'icenode.db');
const DB_DIR = path.dirname(DB_PATH);

// Fonction pour s'assurer que le dossier data existe avec les bonnes permissions
function setupDatabase() {
    console.log('Setting up database...');
    
    // 1. Créer le dossier data s'il n'existe pas
    if (!fs.existsSync(DB_DIR)) {
        console.log('Creating data directory...');
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    // 2. Donner les permissions au dossier
    try {
        fs.chmodSync(DB_DIR, 0o777);
        console.log('Set data directory permissions to 777');
    } catch (err) {
        console.error('Error setting directory permissions:', err);
    }
    
    // 3. Supprimer l'ancienne base de données si elle existe
    const dbFiles = ['icenode.db', 'icenode.db-shm', 'icenode.db-wal'];
    for (const file of dbFiles) {
        const filePath = path.join(DB_DIR, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Removed existing file: ${file}`);
            } catch (err) {
                console.error(`Error removing ${file}:`, err);
            }
        }
    }
    
    // 4. Créer un nouveau fichier vide avec les bonnes permissions
    try {
        fs.writeFileSync(DB_PATH, '', { mode: 0o666 });
        fs.chmodSync(DB_PATH, 0o666);
        console.log('Created empty database file with permissions 666');
    } catch (err) {
        console.error('Error creating database file:', err);
        throw err;
    }
}

// Fonction pour créer les tables
async function createTables(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Activer les foreign keys
            db.run('PRAGMA foreign_keys = ON');
            
            // Créer la table des transactions
            db.run(`CREATE TABLE transactions (
                hash TEXT PRIMARY KEY,
                from_address TEXT,
                to_address TEXT,
                amount TEXT,
                timestamp INTEGER,
                subnet TEXT,
                block_number INTEGER
            )`);

            // Créer la table des contrats déployés
            db.run(`CREATE TABLE contract_deployments (
                contract_address TEXT PRIMARY KEY,
                deployer_address TEXT,
                deployment_tx_hash TEXT,
                bytecode TEXT,
                timestamp INTEGER,
                block_number INTEGER,
                subnet TEXT,
                verified BOOLEAN DEFAULT 0,
                FOREIGN KEY (deployment_tx_hash) REFERENCES transactions(hash)
            )`);

            // Créer la table des tokens
            db.run(`CREATE TABLE tokens (
                address TEXT PRIMARY KEY,
                name TEXT,
                symbol TEXT,
                decimals INTEGER,
                total_supply TEXT,
                created_at INTEGER,
                FOREIGN KEY (address) REFERENCES contract_deployments(contract_address)
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

async function resetDatabase() {
    try {
        // 1. Préparer la base de données
        setupDatabase();
        
        // 2. Créer une nouvelle connexion
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
        
        // 3. Créer les tables
        await createTables(db);
        
        console.log('Database reset successful');
        
        // 4. Fermer la connexion
        db.close();
        
    } catch (err) {
        console.error('Error resetting database:', err);
        process.exit(1);
    }
}

// Exécuter la réinitialisation
resetDatabase();
