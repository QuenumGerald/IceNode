const express = require('express');
const cors = require('cors');
const { initDb, getDb } = require('./db');
const { startIndexing } = require('./indexer');
const searchRoutes = require('./routes/search');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Route pour récupérer les transactions
app.get('/transactions', async (req, res) => {
    try {
        const db = await getDb();
        const { subnet, search, type = 'all' } = req.query;
        
        let query = 'SELECT * FROM transactions';
        const params = [];
        const conditions = [];
        
        if (subnet) {
            conditions.push('subnet = $' + (params.length + 1));
            params.push(subnet);
        }
        
        if (search) {
            switch (type) {
                case 'address':
                    conditions.push('(from_address ILIKE $' + (params.length + 1) + 
                                 ' OR to_address ILIKE $' + (params.length + 1) + ')');
                    params.push(`%${search}%`);
                    break;
                    
                case 'contract':
                    conditions.push('(is_contract = true OR is_contract_creation = true)');
                    if (search !== 'true') {
                        conditions.push('(contract_address ILIKE $' + (params.length + 1) + 
                                     ' OR to_address ILIKE $' + (params.length + 1) + ')');
                        params.push(`%${search}%`);
                    }
                    break;
                    
                case 'hash':
                    conditions.push('hash ILIKE $' + (params.length + 1));
                    params.push(`%${search}%`);
                    break;
                    
                default: // 'all'
                    conditions.push('(hash ILIKE $' + (params.length + 1) + 
                                 ' OR from_address ILIKE $' + (params.length + 1) + 
                                 ' OR to_address ILIKE $' + (params.length + 1) + 
                                 ' OR contract_address ILIKE $' + (params.length + 1) + ')');
                    params.push(`%${search}%`);
            }
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC LIMIT 100';
        
        const result = await db.query(query, params);
        res.json(result.rows || []);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching transactions:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            transactions: []
        });
    }
});

// Route pour les statistiques
app.get('/stats', async (req, res) => {
    try {
        const db = await getDb();
        
        // Requêtes pour les statistiques
        const statsQuery = `
            SELECT 
                subnet,
                COUNT(*) as transaction_count,
                COUNT(DISTINCT from_address) as unique_senders,
                COUNT(DISTINCT to_address) as unique_receivers,
                SUM(CAST(value AS NUMERIC)) as total_volume,
                AVG(CAST(value AS NUMERIC)) as average_value,
                MAX(CAST(value AS NUMERIC)) as max_value,
                MIN(CAST(value AS NUMERIC)) as min_value
            FROM transactions 
            GROUP BY subnet
        `;
        
        const topAddressesQuery = `
            SELECT 
                CASE 
                    WHEN from_address IS NOT NULL THEN from_address 
                    ELSE to_address 
                END as address,
                subnet,
                SUM(CAST(value AS NUMERIC)) as volume
            FROM transactions 
            GROUP BY 
                CASE 
                    WHEN from_address IS NOT NULL THEN from_address 
                    ELSE to_address 
                END,
                subnet
            ORDER BY volume DESC 
            LIMIT 5
        `;
        
        const activityQuery = `
            SELECT 
                subnet,
                date_trunc('hour', created_at) as period,
                COUNT(*) as tx_count
            FROM transactions 
            GROUP BY subnet, period
            ORDER BY period DESC 
            LIMIT 24
        `;
        
        const [stats, topAddresses, activity] = await Promise.all([
            db.query(statsQuery),
            db.query(topAddressesQuery),
            db.query(activityQuery)
        ]);
        
        res.json({
            stats: stats.rows,
            topAddresses: topAddresses.rows,
            activity: activity.rows
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching stats:`, error);
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

// Route de recherche
app.use('/search', searchRoutes);

// Initialiser la base de données et démarrer le serveur
async function start() {
    let retries = 5;
    let lastError = null;

    while (retries > 0) {
        try {
            console.log(`[${new Date().toISOString()}] Démarrage de l'application (tentative ${6 - retries}/5)...`);
            
            // Initialiser la base de données
            await initDb();
            console.log(`[${new Date().toISOString()}] Base de données initialisée avec succès`);
            
            // Démarrer le serveur sur le port défini par Railway ou 3000 par défaut
            app.listen(port, '0.0.0.0', () => {
                console.log(`[${new Date().toISOString()}] Serveur démarré sur le port ${port}`);
            });

            // Démarrer l'indexeur
            await startIndexing().catch(error => {
                console.error(`[${new Date().toISOString()}] Erreur de l'indexeur:`, error);
            });

            // Si on arrive ici, tout s'est bien passé
            console.log(`[${new Date().toISOString()}] Application démarrée avec succès !`);
            return;

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Erreur au démarrage (tentative ${6 - retries}/5):`, error);
            lastError = error;
            retries--;

            if (retries > 0) {
                const delay = Math.min(1000 * Math.pow(2, 5 - retries), 10000);
                console.log(`[${new Date().toISOString()}] Nouvelle tentative dans ${delay/1000} secondes...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Si on arrive ici, toutes les tentatives ont échoué
    console.error(`[${new Date().toISOString()}] Impossible de démarrer l'application après 5 tentatives`);
    console.error(`[${new Date().toISOString()}] Dernière erreur:`, lastError);
    process.exit(1);
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Erreur non capturée:`, error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error(`[${new Date().toISOString()}] Promesse rejetée non gérée:`, error);
    process.exit(1);
});

// Démarrage de l'application
start();
