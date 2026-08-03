const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
    host: 'yamabiko.proxy.rlwy.net',
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway',
    port: 51338,
    ssl: {
        rejectUnauthorized: false // Indispensable para conexiones externas seguras
    }
});

// Prueba de diagnóstico al arrancar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error crítico al conectar con PostgreSQL:', err.message);
    } else {
        console.log('✅ Base de datos conectada exitosamente a través del proxy público de Railway.');
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
