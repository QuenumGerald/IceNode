const express = require('express');
const path = require('path');
const db = require('./database');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Middleware pour la gestion des erreurs de base de données
const handleDbError = (err, res) => {
    console.error('Database error:', err);
    res.status(500).json({ 
        error: err.message,
        code: err.code || 'UNKNOWN_ERROR'
    });
};

// Transactions routes
app.get('/transactions', (req, res) => {
    console.log('GET /transactions', req.query);
    db.all('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10', [], (err, rows) => {
        if (err) {
            console.error('Error in /transactions:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} transactions`);
            res.json(rows || []);
        }
    });
});

app.get('/transactions/:subnet', (req, res) => {
    console.log('GET /transactions/:subnet', req.params);
    const { subnet } = req.params;
    db.all('SELECT * FROM transactions WHERE subnet = ? ORDER BY timestamp DESC LIMIT 10', [subnet], (err, rows) => {
        if (err) {
            console.error('Error in /transactions/:subnet:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} transactions`);
            res.json(rows || []);
        }
    });
});

// Token routes
app.get('/tokens', (req, res) => {
    console.log('GET /tokens');
    db.all('SELECT * FROM tokens', [], (err, rows) => {
        if (err) {
            console.error('Error in /tokens:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} tokens`);
            res.json(rows || []);
        }
    });
});

app.get('/tokens/:address', (req, res) => {
    console.log('GET /tokens/:address', req.params);
    const { address } = req.params;
    db.get('SELECT * FROM tokens WHERE address = ?', [address], (err, row) => {
        if (err) {
            console.error('Error in /tokens/:address:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found token: ${row}`);
            res.json(row || {});
        }
    });
});

// Smart Contract routes
app.get('/contract-calls', (req, res) => {
    console.log('GET /contract-calls', req.query);
    const limit = parseInt(req.query.limit) || 10;
    db.all(`
        SELECT * FROM smart_contract_calls 
        ORDER BY timestamp DESC 
        LIMIT ?`, 
        [limit], 
        (err, rows) => {
            if (err) {
                console.error('Error in /contract-calls:', err);
                handleDbError(err, res);
            } else {
                console.log(`Found ${rows?.length || 0} contract calls`);
                res.json(rows || []);
            }
        }
    );
});

app.get('/contract-calls/:contract', (req, res) => {
    console.log('GET /contract-calls/:contract', req.params);
    const { contract } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    db.all(`
        SELECT * FROM smart_contract_calls 
        WHERE contract_address = ? 
        ORDER BY timestamp DESC 
        LIMIT ?`,
        [contract, limit],
        (err, rows) => {
            if (err) {
                console.error('Error in /contract-calls/:contract:', err);
                handleDbError(err, res);
            } else {
                console.log(`Found ${rows?.length || 0} contract calls`);
                res.json(rows || []);
            }
        }
    );
});

app.get('/contract-calls/function/:name', (req, res) => {
    console.log('GET /contract-calls/function/:name', req.params);
    const { name } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    db.all(`
        SELECT * FROM smart_contract_calls 
        WHERE function_name = ? 
        ORDER BY timestamp DESC 
        LIMIT ?`,
        [name, limit],
        (err, rows) => {
            if (err) {
                console.error('Error in /contract-calls/function/:name:', err);
                handleDbError(err, res);
            } else {
                console.log(`Found ${rows?.length || 0} contract calls`);
                res.json(rows || []);
            }
        }
    );
});

// Stats routes
app.get('/stats', (req, res) => {
    console.log('GET /stats');
    Promise.all([
        // Nombre total de transactions par subnet
        new Promise((resolve, reject) => {
            db.all(
                `SELECT subnet, COUNT(*) as count 
                 FROM transactions 
                 GROUP BY subnet`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        }),
        // Volume total par subnet
        new Promise((resolve, reject) => {
            db.all(
                `SELECT subnet, SUM(CAST(amount AS DECIMAL)) as volume 
                 FROM transactions 
                 GROUP BY subnet`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        }),
        // Nombre de smart contracts déployés
        new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count 
                 FROM contract_deployments`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { count: 0 });
                }
            );
        })
    ])
    .then(([transactions, volumes, contracts]) => {
        console.log('Stats response:', { transactions, volumes, contracts });
        res.json({
            transactions: transactions,
            volumes: volumes,
            contracts: contracts
        });
    })
    .catch(err => {
        console.error('Error in /stats:', err);
        handleDbError(err, res)
    });
});

// Routes de statistiques
app.get('/stats-aggregated', (req, res) => {
    console.log('GET /stats-aggregated');
    const stats = {};
    
    // Utiliser une Promise pour gérer les requêtes asynchrones
    Promise.all([
        // Nombre total de transactions par subnet
        new Promise((resolve, reject) => {
            db.all(
                `SELECT subnet, COUNT(*) as count 
                 FROM transactions 
                 GROUP BY subnet`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        }),
        // Volume total par subnet
        new Promise((resolve, reject) => {
            db.all(
                `SELECT subnet, SUM(CAST(amount AS DECIMAL)) as volume 
                 FROM transactions 
                 GROUP BY subnet`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        }),
        // Nombre de smart contracts déployés
        new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count 
                 FROM contract_deployments`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { count: 0 });
                }
            );
        })
    ])
    .then(([txCounts, volumes, contracts]) => {
        console.log('Stats-aggregated response:', { transactions: txCounts, volumes, contracts });
        res.json({
            transactions: txCounts,
            volumes: volumes,
            contracts: contracts
        });
    })
    .catch(err => {
        console.error('Error in /stats-aggregated:', err);
        handleDbError(err, res)
    });
});

// Routes de transactions
app.get('/transactions-filtered', (req, res) => {
    console.log('GET /transactions-filtered', req.query);
    const { subnet, address, limit = 10, offset = 0 } = req.query;
    let query = 'SELECT * FROM transactions';
    const params = [];
    
    // Construire la requête en fonction des filtres
    const conditions = [];
    if (subnet) {
        conditions.push('subnet = ?');
        params.push(subnet);
    }
    if (address) {
        conditions.push('(from_address = ? OR to_address = ?)');
        params.push(address, address);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error in /transactions-filtered:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} transactions`);
            res.json(rows || []);
        }
    });
});

// Route de recherche de transactions
app.get('/search', (req, res) => {
    console.log('GET /search', req.query);
    const { query, type } = req.query;
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    let sqlQuery;
    let params;
    
    switch (type) {
        case 'address':
            sqlQuery = `
                SELECT * FROM transactions 
                WHERE from_address LIKE ? OR to_address LIKE ? 
                ORDER BY timestamp DESC LIMIT 100
            `;
            params = [`%${query}%`, `%${query}%`];
            break;
            
        case 'hash':
            sqlQuery = `
                SELECT * FROM transactions 
                WHERE hash LIKE ? 
                ORDER BY timestamp DESC LIMIT 100
            `;
            params = [`%${query}%`];
            break;
            
        case 'contract':
            sqlQuery = `
                SELECT cd.*, t.from_address as deployer 
                FROM contract_deployments cd
                LEFT JOIN transactions t ON cd.deployment_tx_hash = t.hash
                WHERE cd.contract_address LIKE ? 
                ORDER BY cd.timestamp DESC LIMIT 100
            `;
            params = [`%${query}%`];
            break;
            
        default:
            return res.status(400).json({ error: 'Invalid search type' });
    }
    
    console.log('Query:', sqlQuery);
    console.log('Params:', params);
    
    db.all(sqlQuery, params, (err, rows) => {
        if (err) {
            console.error('Error in /search:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} results`);
            res.json(rows || []);
        }
    });
});

// Routes de smart contracts
app.get('/contracts', (req, res) => {
    console.log('GET /contracts', req.query);
    const { verified, limit = 10, offset = 0 } = req.query;
    let query = 'SELECT * FROM contract_deployments';
    const params = [];
    
    if (verified !== undefined) {
        query += ' WHERE verified = ?';
        params.push(verified === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error in /contracts:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} contracts`);
            res.json(rows || []);
        }
    });
});

// Routes de tokens
app.get('/tokens', (req, res) => {
    console.log('GET /tokens', req.query);
    const { symbol, limit = 10, offset = 0 } = req.query;
    let query = 'SELECT * FROM tokens';
    const params = [];
    
    if (symbol) {
        query += ' WHERE symbol LIKE ?';
        params.push(`%${symbol}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error in /tokens:', err);
            handleDbError(err, res);
        } else {
            console.log(`Found ${rows?.length || 0} tokens`);
            res.json(rows || []);
        }
    });
});

// Health check pour Railway
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: Date.now() });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
