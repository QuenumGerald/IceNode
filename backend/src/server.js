const express = require('express');
const path = require('path');
const { db, connectToDatabase, asyncAll } = require('./database');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
app.use(cors({
    origin: ['https://ice-front-production.up.railway.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: err.message || 'Internal Server Error',
        code: err.code || 'UNKNOWN_ERROR',
        path: req.path
    });
};

// Middlewares
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test de la base de données
        const dbTest = await asyncAll('SELECT COUNT(*) as count FROM transactions');
        const memoryUsage = process.memoryUsage();
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                transactionCount: dbTest[0]?.count || 0
            },
            memory: {
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
                rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
            },
            environment: {
                nodeEnv: process.env.NODE_ENV,
                port: process.env.PORT
            },
            version: process.version
        });
    } catch (err) {
        console.error('Health check failed:', err);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: err.message
        });
    }
});

// Transactions routes
app.get('/transactions', async (req, res, next) => {
    try {
        console.log('GET /transactions - Start');
        
        await connectToDatabase();
        
        const query = `
            SELECT 
                hash,
                blockNumber,
                "from" as from_address,
                "to" as to_address,
                value,
                timestamp,
                subnet
            FROM transactions 
            ORDER BY timestamp DESC 
            LIMIT 10
        `;

        const rows = await asyncAll(query);
        console.log(`Found ${rows?.length || 0} transactions`);
        
        const formattedRows = (rows || []).map(row => ({
            hash: row.hash,
            blockNumber: row.blockNumber,
            from: row.from_address,
            to: row.to_address,
            value: row.value,
            timestamp: row.timestamp
        }));
        
        res.json(formattedRows);
    } catch (err) {
        console.error('Error in /transactions:', err);
        next(err);
    }
});

app.get('/transactions/:subnet', async (req, res, next) => {
    try {
        console.log('GET /transactions/:subnet', req.params);
        const { subnet } = req.params;
        const query = `
            SELECT 
                hash,
                blockNumber,
                "from" as from_address,
                "to" as to_address,
                value,
                timestamp,
                subnet
            FROM transactions 
            WHERE subnet = ? 
            ORDER BY timestamp DESC 
            LIMIT 10
        `;

        const rows = await asyncAll(query, [subnet]);
        console.log(`Found ${rows?.length || 0} transactions`);
        
        const formattedRows = (rows || []).map(row => ({
            hash: row.hash,
            blockNumber: row.blockNumber,
            from: row.from_address,
            to: row.to_address,
            value: row.value,
            timestamp: row.timestamp
        }));
        
        res.json(formattedRows);
    } catch (err) {
        console.error('Error in /transactions/:subnet:', err);
        next(err);
    }
});

// Token routes
app.get('/tokens', async (req, res, next) => {
    try {
        console.log('GET /tokens');
        const query = `
            SELECT 
                address,
                symbol,
                name,
                totalSupply,
                decimals,
                created_at
            FROM tokens 
        `;

        const rows = await asyncAll(query);
        console.log(`Found ${rows?.length || 0} tokens`);
        
        const formattedRows = (rows || []).map(row => ({
            address: row.address,
            symbol: row.symbol,
            name: row.name,
            totalSupply: row.totalSupply,
            decimals: row.decimals,
            createdAt: row.created_at
        }));
        
        res.json(formattedRows);
    } catch (err) {
        console.error('Error in /tokens:', err);
        next(err);
    }
});

app.get('/tokens/:address', async (req, res, next) => {
    try {
        console.log('GET /tokens/:address', req.params);
        const { address } = req.params;
        const query = `
            SELECT 
                address,
                symbol,
                name,
                totalSupply,
                decimals,
                created_at
            FROM tokens 
            WHERE address = ?
        `;

        const row = await asyncAll(query, [address]);
        console.log(`Found token: ${row}`);
        
        const formattedRow = {
            address: row.address,
            symbol: row.symbol,
            name: row.name,
            totalSupply: row.totalSupply,
            decimals: row.decimals,
            createdAt: row.created_at
        };
        
        res.json(formattedRow || {});
    } catch (err) {
        console.error('Error in /tokens/:address:', err);
        next(err);
    }
});

// Smart Contract routes
app.get('/contract-calls', async (req, res, next) => {
    try {
        console.log('GET /contract-calls', req.query);
        const limit = parseInt(req.query.limit) || 10;
        const query = `
            SELECT 
                id,
                contract_address,
                function_name,
                input_data,
                output_data,
                timestamp
            FROM smart_contract_calls 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;

        const rows = await asyncAll(query, [limit]);
        console.log(`Found ${rows?.length || 0} contract calls`);
        
        const formattedRows = (rows || []).map(row => ({
            id: row.id,
            contractAddress: row.contract_address,
            functionName: row.function_name,
            inputData: row.input_data,
            outputData: row.output_data,
            timestamp: row.timestamp
        }));
        
        res.json(formattedRows);
    } catch (err) {
        console.error('Error in /contract-calls:', err);
        next(err);
    }
});

app.get('/contract-calls/:contract', async (req, res, next) => {
    try {
        console.log('GET /contract-calls/:contract', req.params);
        const { contract } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const query = `
            SELECT 
                id,
                contract_address,
                function_name,
                input_data,
                output_data,
                timestamp
            FROM smart_contract_calls 
            WHERE contract_address = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;

        const rows = await asyncAll(query, [contract, limit]);
        console.log(`Found ${rows?.length || 0} contract calls`);
        
        const formattedRows = (rows || []).map(row => ({
            id: row.id,
            contractAddress: row.contract_address,
            functionName: row.function_name,
            inputData: row.input_data,
            outputData: row.output_data,
            timestamp: row.timestamp
        }));
        
        res.json(formattedRows);
    } catch (err) {
        console.error('Error in /contract-calls/:contract:', err);
        next(err);
    }
});

app.get('/contract-calls/function/:name', async (req, res, next) => {
    try {
        console.log('GET /contract-calls/function/:name', req.params);
        const { name } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const query = `
            SELECT 
                id,
                contract_address,
                function_name,
                input_data,
                output_data,
                timestamp
            FROM smart_contract_calls 
            WHERE function_name = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;

        const rows = await asyncAll(query, [name, limit]);
        console.log(`Found ${rows?.length || 0} contract calls`);
        
        const formattedRows = (rows || []).map(row => ({
            id: row.id,
            contractAddress: row.contract_address,
            functionName: row.function_name,
            inputData: row.input_data,
            outputData: row.output_data,
            timestamp: row.timestamp
        }));
        
        res.json(formattedRows);
    } catch (err) {
        console.error('Error in /contract-calls/function/:name:', err);
        next(err);
    }
});

// Stats routes
app.get('/stats', async (req, res, next) => {
    try {
        console.log('GET /stats');
        const stats = {
            transactions: [],
            volumes: [],
            contracts: { count: 0 }
        };
        
        try {
            // Nombre total de transactions par subnet
            stats.transactions = await asyncAll(
                `SELECT subnet, COUNT(*) as count 
                 FROM transactions 
                 GROUP BY subnet`
            ) || [];
        } catch (err) {
            console.error('Error fetching transaction stats:', err);
            stats.transactions = [];
        }

        try {
            // Volume total par subnet
            stats.volumes = await asyncAll(
                `SELECT subnet, SUM(CAST(value AS DECIMAL)) as volume 
                 FROM transactions 
                 GROUP BY subnet`
            ) || [];
        } catch (err) {
            console.error('Error fetching volume stats:', err);
            stats.volumes = [];
        }

        try {
            // Nombre de smart contracts déployés
            const contracts = await asyncAll(
                `SELECT COUNT(*) as count 
                 FROM contract_deployments`
            );
            stats.contracts = contracts?.[0] || { count: 0 };
        } catch (err) {
            console.error('Error fetching contract stats:', err);
            stats.contracts = { count: 0 };
        }

        res.json(stats);
    } catch (err) {
        console.error('Error in /stats endpoint:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to fetch statistics'
        });
    }
});

// Routes de statistiques
app.get('/stats-aggregated', async (req, res, next) => {
    try {
        console.log('GET /stats-aggregated');
        const stats = {};
        
        // Utiliser une Promise pour gérer les requêtes asynchrones
        const promises = [
            // Nombre total de transactions par subnet
            asyncAll(
                `SELECT subnet, COUNT(*) as count 
                 FROM transactions 
                 GROUP BY subnet`
            ),
            // Volume total par subnet
            asyncAll(
                `SELECT subnet, SUM(CAST(amount AS DECIMAL)) as volume 
                 FROM transactions 
                 GROUP BY subnet`
            ),
            // Nombre de smart contracts déployés
            asyncAll(
                `SELECT COUNT(*) as count 
                 FROM contract_deployments`
            )
        ];
        
        const [txCounts, volumes, contracts] = await Promise.all(promises);
        
        console.log('Stats-aggregated response:', { transactions: txCounts, volumes, contracts });
        res.json({
            transactions: txCounts,
            volumes: volumes,
            contracts: contracts
        });
    } catch (err) {
        console.error('Error in /stats-aggregated:', err);
        next(err);
    }
});

// Routes de transactions
app.get('/transactions-filtered', async (req, res, next) => {
    try {
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
        
        const rows = await asyncAll(query, params);
        console.log(`Found ${rows?.length || 0} transactions`);
        
        res.json(rows || []);
    } catch (err) {
        console.error('Error in /transactions-filtered:', err);
        next(err);
    }
});

// Route de recherche de transactions
app.get('/search', async (req, res, next) => {
    try {
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
        
        const rows = await asyncAll(sqlQuery, params);
        console.log(`Found ${rows?.length || 0} results`);
        
        res.json(rows || []);
    } catch (err) {
        console.error('Error in /search:', err);
        next(err);
    }
});

// Routes de smart contracts
app.get('/contracts', async (req, res, next) => {
    try {
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
        
        const rows = await asyncAll(query, params);
        console.log(`Found ${rows?.length || 0} contracts`);
        
        res.json(rows || []);
    } catch (err) {
        console.error('Error in /contracts:', err);
        next(err);
    }
});

// Routes de tokens
app.get('/tokens', async (req, res, next) => {
    try {
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
        
        const rows = await asyncAll(query, params);
        console.log(`Found ${rows?.length || 0} tokens`);
        
        res.json(rows || []);
    } catch (err) {
        console.error('Error in /tokens:', err);
        next(err);
    }
});

// Health check pour Railway
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Add error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
});
