const db = require('./database');

// Fonction pour compter les transactions par subnet
function countTransactions() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT subnet, COUNT(*) as count 
             FROM transactions 
             GROUP BY subnet`,
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// Fonction pour obtenir les dernières transactions
function getLatestTransactions() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM transactions 
             ORDER BY timestamp DESC 
             LIMIT 5`,
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// Fonction principale de test
async function runTests() {
    try {
        console.log('\nVérification de la base de données...');
        
        // Attendre 10 secondes pour laisser l'indexeur collecter des données
        console.log('Attente de 10 secondes pour la collecte des données...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Vérifier le nombre de transactions par subnet
        console.log('\nNombre de transactions par subnet:');
        const counts = await countTransactions();
        console.log(counts);

        // Vérifier les dernières transactions
        console.log('\nDernières transactions:');
        const latest = await getLatestTransactions();
        console.log(JSON.stringify(latest, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Erreur lors des tests:', err);
        process.exit(1);
    }
}

// Lancer les tests
runTests();
