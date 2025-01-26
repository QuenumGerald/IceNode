const db = require('./database');

// Vérifier les smart contract calls
db.all('SELECT COUNT(*) as count FROM smart_contract_calls', [], (err, rows) => {
    if (err) {
        console.error('Erreur lors de la vérification des smart contract calls:', err);
    } else {
        console.log('Nombre de smart contract calls:', rows[0].count);
    }
});

// Vérifier les tokens
db.all('SELECT COUNT(*) as count FROM tokens', [], (err, rows) => {
    if (err) {
        console.error('Erreur lors de la vérification des tokens:', err);
    } else {
        console.log('Nombre de tokens:', rows[0].count);
    }
});

// Vérifier les transactions
db.all('SELECT COUNT(*) as count FROM transactions', [], (err, rows) => {
    if (err) {
        console.error('Erreur lors de la vérification des transactions:', err);
    } else {
        console.log('Nombre de transactions:', rows[0].count);
    }
});
