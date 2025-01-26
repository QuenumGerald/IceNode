const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'icenode.db');
const DB_DIR = path.dirname(DB_PATH);

// S'assurer que le dossier data existe
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('Using database:', DB_PATH);

// Créer la connexion à la base de données
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Promisify les fonctions de la base de données
function asyncRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function asyncAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function asyncGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Exporter les fonctions
module.exports = {
    db,
    asyncRun,
    asyncAll,
    asyncGet,
    run: db.run.bind(db),
    all: db.all.bind(db),
    get: db.get.bind(db)
};
