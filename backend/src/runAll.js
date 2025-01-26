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
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Initialiser la base de données et démarrer le serveur
async function start() {
    try {
        // Initialiser la base de données
        await initDb();
        
        // Démarrer le serveur sur le port défini par Railway ou 3000 par défaut
        const port = process.env.PORT || 3000;
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server running on port ${port}`);
        });

        // Démarrer l'indexeur
        startIndexing().catch(error => {
            console.error('Indexer error:', error);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();
