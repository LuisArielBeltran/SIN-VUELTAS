const { Pool } = require('pg');
require('dotenv').config();

// Priorizamos la URL pública para evitar errores de resolución de red interna
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Indispensable para Railway
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
