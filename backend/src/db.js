const { Pool } = require('pg');

let pool = null;

// Fonction pour attendre avec un délai
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configuration du nettoyage de la base de données
const DB_CONFIG = {
    RETENTION_HOURS: 1, // Garder seulement 1 heure de données
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // Nettoyer toutes les heures
    MAX_TRANSACTIONS: 1000000, // Limite maximale de transactions
    BATCH_SIZE: 10000, // Taille des lots pour la suppression
    BATCH_PAUSE_MS: 1000 // Pause entre les lots
};

// Nettoyage périodique de la base de données
async function cleanDatabase() {
    if (!pool) return;
    
    try {
        const client = await pool.connect();
        try {
            console.log(`[${new Date().toISOString()}] Début du nettoyage de la base de données...`);
            
            // Vérifier le nombre total de transactions
            const countResult = await client.query('SELECT COUNT(*) as total FROM transactions');
            const totalTransactions = parseInt(countResult.rows[0].total);
            console.log(`[${new Date().toISOString()}] Nombre total de transactions: ${totalTransactions}`);
            
            // On garde seulement les transactions de la dernière heure
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - DB_CONFIG.RETENTION_HOURS);
            
            // Supprimer les anciennes transactions par lots
            let totalDeleted = 0;
            while (true) {
                const result = await client.query(`
                    WITH to_delete AS (
                        SELECT ctid 
                        FROM transactions 
                        WHERE created_at < $1 
                        OR ctid IN (
                            SELECT ctid 
                            FROM transactions 
                            ORDER BY created_at DESC 
                            OFFSET $2
                        )
                        LIMIT $3
                    )
                    DELETE FROM transactions 
                    WHERE ctid IN (SELECT ctid FROM to_delete)
                    RETURNING *;
                `, [cutoffTime, DB_CONFIG.MAX_TRANSACTIONS, DB_CONFIG.BATCH_SIZE]);
                
                const deletedCount = result.rowCount;
                totalDeleted += deletedCount;
                
                console.log(`[${new Date().toISOString()}] Lot supprimé: ${deletedCount} transactions`);
                
                if (deletedCount < DB_CONFIG.BATCH_SIZE) break;
                
                // Pause entre les lots
                await wait(DB_CONFIG.BATCH_PAUSE_MS);
            }
            
            console.log(`[${new Date().toISOString()}] Nettoyage BDD terminé: ${totalDeleted} transactions supprimées au total`);
            
            if (totalDeleted > 0) {
                // VACUUM simple pour libérer l'espace
                await client.query('VACUUM transactions;');
                console.log(`[${new Date().toISOString()}] VACUUM terminé`);
            }
            
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Erreur lors du nettoyage de la base de données:`, err);
    }
}

// Fonction pour tenter une connexion avec retries
async function connectWithRetry(maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`[${new Date().toISOString()}] Tentative de connexion à PostgreSQL (${i + 1}/${maxRetries})...`);

            const client = await pool.connect();
            console.log(`[${new Date().toISOString()}] Connexion à PostgreSQL établie avec succès`);
            return client;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Échec de la connexion (tentative ${i + 1}/${maxRetries}):`, error.message);
            if (i < maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, i), 10000);
                console.log(`Nouvelle tentative dans ${delay / 1000} secondes...`);
                await wait(delay);
            } else {
                throw new Error(`Impossible de se connecter à PostgreSQL après ${maxRetries} tentatives`);
            }
        }
    }
}

// Initialisation de la base de données
async function initDb() {
    try {
        console.log(`[${new Date().toISOString()}] Initialisation de la connexion à PostgreSQL...`);
        
        // Configuration de la connexion PostgreSQL
        const isRailwayInternal = process.env.RAILWAY_ENVIRONMENT === 'production';
        const dbConfig = {
            connectionString: isRailwayInternal 
                ? 'postgresql://postgres:XMJUMbyeMKevHMikWrvBGGFoWSOqiIED@postgres.railway.internal:5432/railway'
                : process.env.DATABASE_URL,
            ssl: isRailwayInternal ? false : {
                rejectUnauthorized: false
            }
        };

        console.log(`[${new Date().toISOString()}] Mode de connexion: ${isRailwayInternal ? 'Railway Internal' : 'External'}`);
        
        pool = new Pool(dbConfig);

        // Configuration du gestionnaire d'erreurs du pool
        pool.on('error', (err) => {
            console.error(`[${new Date().toISOString()}] Erreur inattendue du pool PostgreSQL:`, err);
            process.exit(-1);
        });

        const client = await connectWithRetry();
        try {
            // Vérifier si la table existe déjà
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'transactions'
                );
            `);

            if (!tableExists.rows[0].exists) {
                // Création de la table si elle n'existe pas
                await client.query(`
                    CREATE TABLE transactions (
                        hash VARCHAR(66) PRIMARY KEY,
                        from_address VARCHAR(42) NOT NULL,
                        to_address VARCHAR(42),
                        value TEXT NOT NULL,
                        subnet VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        is_contract_creation BOOLEAN DEFAULT FALSE,
                        is_contract BOOLEAN DEFAULT FALSE,
                        contract_address VARCHAR(42),
                        contract_code TEXT,
                        contract_abi TEXT
                    )
                `);
                console.log(`[${new Date().toISOString()}] Table transactions créée`);
            } else {
                // Ajouter les nouvelles colonnes si elles n'existent pas
                const columnsToAdd = [
                    'is_contract_creation BOOLEAN DEFAULT FALSE',
                    'is_contract BOOLEAN DEFAULT FALSE',
                    'contract_address VARCHAR(42)',
                    'contract_code TEXT',
                    'contract_abi TEXT'
                ];

                for (const column of columnsToAdd) {
                    const columnName = column.split(' ')[0];
                    try {
                        await client.query(`
                            ALTER TABLE transactions 
                            ADD COLUMN IF NOT EXISTS ${column}
                        `);
                        console.log(`[${new Date().toISOString()}] Colonne ${columnName} ajoutée ou déjà existante`);
                    } catch (err) {
                        console.error(`[${new Date().toISOString()}] Erreur lors de l'ajout de la colonne ${columnName}:`, err);
                    }
                }
            }

            // Supprimer les anciens index s'ils existent
            const dropIndexes = [
                'idx_transactions_from_address',
                'idx_transactions_to_address',
                'idx_transactions_subnet',
                'idx_transactions_created_at',
                'idx_transactions_is_contract',
                'idx_transactions_contract_address'
            ];

            for (const indexName of dropIndexes) {
                try {
                    await client.query(`DROP INDEX IF EXISTS ${indexName}`);
                    console.log(`[${new Date().toISOString()}] Index ${indexName} supprimé s'il existait`);
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] Erreur lors de la suppression de l'index ${indexName}:`, err);
                }
            }

            // Créer les nouveaux index
            const createIndexes = [
                'CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_subnet ON transactions(subnet)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_is_contract ON transactions(is_contract)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_contract_address ON transactions(contract_address)'
            ];

            for (const createIndex of createIndexes) {
                try {
                    await client.query(createIndex);
                    const indexName = createIndex.match(/idx_\w+/)[0];
                    console.log(`[${new Date().toISOString()}] Index ${indexName} créé`);
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] Erreur lors de la création de l'index:`, err);
                }
            }

            console.log(`[${new Date().toISOString()}] Base de données initialisée avec succès`);

            // Premier nettoyage
            await cleanDatabase();

            // Planifier le nettoyage toutes les heures
            setInterval(cleanDatabase, DB_CONFIG.CLEANUP_INTERVAL_MS);

        } finally {
            client.release();
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Erreur lors de l'initialisation de la base de données:`, err);
        throw err;
    }
}

function getDb() {
    if (!pool) {
        throw new Error('La base de données n\'est pas initialisée');
    }
    return pool;
}

module.exports = {
    initDb,
    getDb,
    cleanDatabase
};
