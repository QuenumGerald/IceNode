const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const displayBanner = require('./banner');

// Afficher le banner au démarrage
displayBanner();

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/icenode.db');
const DB_DIR = path.dirname(DB_PATH);

// Fonction pour s'assurer que le dossier data existe avec les bonnes permissions
function ensureDataDirectory() {
    console.log(`Setting up data directory: ${DB_DIR}`);
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    // Définir les permissions
    fs.chmodSync(DB_DIR, '777');
    console.log('Set directory permissions to 777');
    
    // Supprimer la base de données si elle existe
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log('Removed existing file:', path.basename(DB_PATH));
    }
    
    // Créer un fichier vide avec les bonnes permissions
    fs.writeFileSync(DB_PATH, '');
    fs.chmodSync(DB_PATH, '666');
    console.log('Created empty database file with permissions 666');
}

// Fonction pour démarrer un processus
function startProcess(scriptPath, args = [], name = '') {
    console.log(`Starting ${name}...`);
    const nodeProcess = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit',
        env: process.env
    });
    
    nodeProcess.on('error', (err) => {
        console.error(`Error starting ${name}:`, err);
    });
    
    return nodeProcess;
}

// Démarrer tous les services
async function startAll() {
    try {
        // Préparer le dossier data
        console.log('Preparing data directory...');
        ensureDataDirectory();

        // Réinitialiser la base de données
        console.log('Resetting database...');
        startProcess(path.join(__dirname, 'resetDatabase.js'), [], 'Database Reset');

        // Démarrer le serveur backend
        console.log('Starting backend server...');
        startProcess(path.join(__dirname, 'server.js'), [], 'Server');

        // Démarrer les indexers
        console.log('Starting indexers...');
        console.log('Starting Main Indexer...');
        startProcess(path.join(__dirname, 'indexer.js'), ['mainnet'], 'Main Chain Indexer');
        
        console.log('Starting DFK Indexer...');
        startProcess(path.join(__dirname, 'indexer.js'), ['dfk'], 'DFK Chain Indexer');
        
        console.log('Starting Dexalot Indexer...');
        startProcess(path.join(__dirname, 'indexer.js'), ['dexalot'], 'Dexalot Chain Indexer');

    } catch (error) {
        console.error('Error starting services:', error);
        process.exit(1);
    }
}

// Démarrer tout
console.log('Starting all services...');
startAll();
