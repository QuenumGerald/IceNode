const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const displayBanner = require('./banner');

// Afficher le banner au démarrage
displayBanner();

// Configuration
const DB_PATH = '/data/icenode.db';
const DB_DIR = path.dirname(DB_PATH);
const RPC_URL = 'https://api.avax.network/ext/bc/C/rpc';
const SUBNET_RPC_URLS = ['https://api.avax.network/ext/bc/C/rpc', 'https://api.dfkchain.com/ext/bc/C/rpc', 'https://dexalot-rpc.com/ext/bc/C/rpc'];

// Fonction pour s'assurer que le dossier data existe avec les bonnes permissions
function ensureDataDirectory() {
    console.log(`Setting up data directory: ${DB_DIR}`);
    
    try {
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(DB_DIR)) {
            console.log(`Creating directory: ${DB_DIR}`);
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
        
        // Définir les permissions
        console.log(`Setting permissions for: ${DB_DIR}`);
        fs.chmodSync(DB_DIR, '777');
        console.log('Set directory permissions to 777');
        
        // Supprimer la base de données si elle existe
        if (fs.existsSync(DB_PATH)) {
            console.log(`Removing existing database: ${DB_PATH}`);
            fs.unlinkSync(DB_PATH);
            console.log('Removed existing file:', path.basename(DB_PATH));
        }
        
        // Créer un fichier vide avec les bonnes permissions
        console.log(`Creating empty database: ${DB_PATH}`);
        fs.writeFileSync(DB_PATH, '');
        fs.chmodSync(DB_PATH, '666');
        console.log('Created empty database file with permissions 666');
    } catch (error) {
        console.error('Error in ensureDataDirectory:', error);
        throw error;
    }
}

// Fonction pour démarrer un processus
function startProcess(scriptPath, args = [], name = '') {
    console.log(`Starting ${name}...`);
    console.log(`Command: node ${scriptPath} ${args.join(' ')}`);
    
    try {
        const nodeProcess = spawn('node', [scriptPath, ...args], {
            stdio: 'inherit',
            env: {
                ...process.env,
                DB_PATH: DB_PATH,
                RPC_URL: RPC_URL,
                SUBNET_RPC_URLS: SUBNET_RPC_URLS.join(',')
            }
        });
        
        nodeProcess.on('error', (err) => {
            console.error(`Error in ${name}:`, err);
        });
        
        nodeProcess.on('exit', (code) => {
            console.log(`${name} exited with code ${code}`);
        });
        
        return nodeProcess;
    } catch (error) {
        console.error(`Error starting ${name}:`, error);
        throw error;
    }
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

        console.log('All services started successfully!');

    } catch (error) {
        console.error('Error starting services:', error);
        process.exit(1);
    }
}

// Démarrer tout
console.log('Starting all services...');
startAll().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
