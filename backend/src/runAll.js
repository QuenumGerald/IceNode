const express = require('express');
const cors = require('cors');
const { startIndexing } = require('./indexer');
const { initDb, getDb } = require('./db');

const app = express();
app.use(cors());

// Route pour récupérer les transactions
app.get('/transactions', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows || []); // Retourne un tableau vide si pas de résultats
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            transactions: [] // Retourne un tableau vide en cas d'erreur
        });
    }
});

// Route pour les statistiques
app.get('/stats', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.query(`
            SELECT 
                subnet,
                COUNT(*) as transaction_count
            FROM transactions 
            GROUP BY subnet
        `);
        res.json(result.rows || []); // Retourne un tableau vide si pas de résultats
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            stats: [] // Retourne un tableau vide en cas d'erreur
        });
    }
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// Initialiser la base de données et démarrer le serveur
async function start() {
    let retries = 5;
    let lastError = null;

    while (retries > 0) {
        try {
            console.log(`Démarrage de l'application (tentative ${6 - retries}/5)...`);
            
            // Initialiser la base de données
            await initDb();
            
            // Démarrer le serveur sur le port défini par Railway ou 3000 par défaut
            const port = process.env.PORT || 3000;
            app.listen(port, '0.0.0.0', () => {
                console.log(`Serveur démarré sur le port ${port}`);
            });

            // Démarrer l'indexeur
            startIndexing().catch(error => {
                console.error('Erreur de l\'indexeur:', error);
            });

            // Si on arrive ici, tout s'est bien passé
            console.log('Application démarrée avec succès !');
            return;

        } catch (error) {
            console.error(`Erreur au démarrage (tentative ${6 - retries}/5):`, error);
            lastError = error;
            retries--;

            if (retries > 0) {
                const delay = Math.min(1000 * Math.pow(2, 5 - retries), 10000);
                console.log(`Nouvelle tentative dans ${delay/1000} secondes...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Si on arrive ici, toutes les tentatives ont échoué
    console.error('Impossible de démarrer l\'application après 5 tentatives');
    console.error('Dernière erreur:', lastError);
    process.exit(1);
}

start();
