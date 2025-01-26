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
        const { subnet, search } = req.query;
        
        let query = 'SELECT * FROM transactions';
        const params = [];
        const conditions = [];
        
        if (subnet) {
            conditions.push('subnet = $' + (params.length + 1));
            params.push(subnet);
        }
        
        if (search) {
            conditions.push('(hash ILIKE $' + (params.length + 1) + 
                         ' OR from_address ILIKE $' + (params.length + 1) + 
                         ' OR to_address ILIKE $' + (params.length + 1) + ')');
            params.push(`%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC LIMIT 100';
        
        const result = await db.query(query, params);
        res.json(result.rows || []);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            transactions: []
        });
    }
});

// Route pour les statistiques détaillées
app.get('/stats', async (req, res) => {
    try {
        const db = await getDb();
        
        // 1. Nombre de transactions par subnet
        const transactionCountQuery = `
            SELECT 
                subnet,
                COUNT(*) as transaction_count,
                COUNT(DISTINCT from_address) as unique_senders,
                COUNT(DISTINCT to_address) as unique_receivers,
                SUM(CAST(value AS DECIMAL)) as total_volume,
                AVG(CAST(value AS DECIMAL)) as average_value,
                MAX(CAST(value AS DECIMAL)) as max_value,
                MIN(CAST(value AS DECIMAL)) as min_value
            FROM transactions 
            GROUP BY subnet
        `;
        
        // 2. Top 5 des adresses par volume
        const topAddressesQuery = `
            WITH address_volumes AS (
                SELECT 
                    from_address as address,
                    subnet,
                    SUM(CAST(value AS DECIMAL)) as volume
                FROM transactions
                GROUP BY from_address, subnet
            )
            SELECT 
                address,
                subnet,
                volume
            FROM address_volumes
            ORDER BY volume DESC
            LIMIT 5
        `;

        // 3. Activité par période
        const activityQuery = `
            SELECT 
                subnet,
                date_trunc('hour', created_at) as period,
                COUNT(*) as tx_count
            FROM transactions
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY subnet, period
            ORDER BY period DESC
        `;

        // Exécution des requêtes en parallèle
        const [transactionStats, topAddresses, activity] = await Promise.all([
            db.query(transactionCountQuery),
            db.query(topAddressesQuery),
            db.query(activityQuery)
        ]);

        res.json({
            stats: transactionStats.rows || [],
            topAddresses: topAddresses.rows || [],
            activity: activity.rows || []
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            stats: [],
            topAddresses: [],
            activity: []
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
