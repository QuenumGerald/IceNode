require('dotenv').config();
const { initDb } = require('./db');

async function main() {
    try {
        console.log('Initializing database...');
        await initDb();
        console.log('Database initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

main();
