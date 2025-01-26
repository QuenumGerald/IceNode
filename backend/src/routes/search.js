const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// Route pour rechercher des transactions
router.get('/', async (req, res) => {
    try {
        const { 
            query,           // Recherche générale
            address,        // Recherche par adresse (from ou to)
            subnet,         // Filtre par subnet
            isContract,     // Filtre les contrats
            limit = 100     // Limite de résultats
        } = req.query;

        const db = getDb();
        let sqlQuery = `
            SELECT * 
            FROM transactions 
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // Recherche générale
        if (query) {
            sqlQuery += `
                AND (
                    hash ILIKE $${paramCount} OR
                    from_address ILIKE $${paramCount} OR
                    to_address ILIKE $${paramCount} OR
                    contract_address ILIKE $${paramCount}
                )
            `;
            params.push(`%${query}%`);
            paramCount++;
        }

        // Recherche par adresse
        if (address) {
            sqlQuery += `
                AND (
                    from_address ILIKE $${paramCount} OR
                    to_address ILIKE $${paramCount} OR
                    contract_address ILIKE $${paramCount}
                )
            `;
            params.push(`%${address}%`);
            paramCount++;
        }

        // Filtre par subnet
        if (subnet) {
            sqlQuery += ` AND subnet = $${paramCount}`;
            params.push(subnet);
            paramCount++;
        }

        // Filtre les contrats
        if (isContract !== undefined) {
            sqlQuery += ` AND is_contract = $${paramCount}`;
            params.push(isContract === 'true');
            paramCount++;
        }

        // Tri par date décroissante et limite
        sqlQuery += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        const result = await db.query(sqlQuery, params);

        res.json({
            success: true,
            count: result.rows.length,
            transactions: result.rows
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erreur de recherche:`, error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la recherche'
        });
    }
});

module.exports = router;
