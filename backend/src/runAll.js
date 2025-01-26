const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const displayBanner = require('./banner');

// Afficher le banner au démarrage
displayBanner();

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'icenode.db');
const DB_DIR = path.dirname(DB_PATH);

// Fonction pour s'assurer que le dossier data existe avec les bonnes permissions
function ensureDataDirectory() {
    console.log('Setting up data directory:', DB_DIR);
    
    // Créer le dossier avec les bonnes permissions
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    try {
        // Donner les permissions au dossier
        fs.chmodSync(DB_DIR, 0o777);
        console.log('Set directory permissions to 777');
        
        // Supprimer les anciens fichiers de base de données
        const dbFiles = ['icenode.db', 'icenode.db-shm', 'icenode.db-wal'];
        dbFiles.forEach(file => {
            const filePath = path.join(DB_DIR, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Removed existing file: ${file}`);
            }
        });

        // Créer un nouveau fichier de base de données vide avec les bonnes permissions
        fs.writeFileSync(DB_PATH, '', { mode: 0o666 });
        fs.chmodSync(DB_PATH, 0o666);
        console.log('Created empty database file with permissions 666');
        
    } catch (err) {
        console.error('Error setting up data directory:', err);
        throw err;
    }
}

// Fonction pour démarrer un processus
function startProcess(scriptPath, args = [], name = '') {
    console.log(`Starting ${name}...`);
    const process = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit'
    });

    process.on('error', (err) => {
        console.error(`Error in ${name}:`, err);
    });

    return process;
}

// Démarrer tous les services
async function startAll() {
    try {
        // 1. Préparer le dossier data
        console.log('Preparing data directory...');
        ensureDataDirectory();

        // 2. Réinitialiser la base de données
        console.log('Resetting database...');
        require('./resetDatabase');

        // 3. Démarrer le serveur backend
        console.log('Starting backend server...');
        const server = startProcess('server.js', [], 'Server');
        
        // Attendre un peu que le serveur démarre
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Démarrer les indexeurs
        console.log('Starting indexers...');
        const mainIndexer = startProcess('indexer.js', [], 'Main Indexer');
        const dfkIndexer = startProcess('indexer.js', ['--subnet=DFK'], 'DFK Indexer');
        const dexalotIndexer = startProcess('indexer.js', ['--subnet=Dexalot'], 'Dexalot Indexer');

        // 5. Démarrer le frontend
        console.log('Starting frontend...');
        const frontend = startProcess('cd dashboard && npm run dev', [], 'Frontend');

        // Gérer la fermeture propre
        process.on('SIGINT', () => {
            console.log('Shutting down all processes...');
            server.kill();
            mainIndexer.kill();
            dfkIndexer.kill();
            dexalotIndexer.kill();
            frontend.kill();
            process.exit(0);
        });

    } catch (err) {
        console.error('Error starting services:', err);
        process.exit(1);
    }
}

// Démarrer tout
console.log('Starting all services...');
startAll();
