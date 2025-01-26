require('dotenv').config();
const { spawn } = require('child_process');

// Fonction pour démarrer un processus avec gestion d'erreur détaillée
function startProcess(scriptName) {
    console.log(`\n=== Démarrage de ${scriptName} ===`);
    
    const process = spawn('node', [scriptName], {
        stdio: ['inherit', 'pipe', 'pipe']
    });

    process.stdout.on('data', (data) => {
        console.log(`[${scriptName}] ${data.toString().trim()}`);
    });

    process.stderr.on('data', (data) => {
        console.error(`[${scriptName} ERROR] ${data.toString().trim()}`);
    });

    process.on('error', (err) => {
        console.error(`[${scriptName}] Erreur de processus:`, err);
    });

    process.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[${scriptName}] Processus terminé avec code ${code}`);
        } else {
            console.log(`[${scriptName}] Processus terminé normalement`);
        }
    });

    return process;
}

// Démarrer le processus spécifié en argument
const scriptName = process.argv[2];
if (!scriptName) {
    console.error('Usage: node debug.js <script_name>');
    process.exit(1);
}

const proc = startProcess(scriptName);

// Gérer l'arrêt propre
process.on('SIGINT', () => {
    console.log('\nArrêt du processus...');
    proc.kill();
    process.exit();
});
