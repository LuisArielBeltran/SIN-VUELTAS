const { Pool } = require('pg');
require('dotenv').config();

// Conexión directa y blindada usando el proxy público de Railway
const pool = new Pool({
    user: process.env.PGUSER || process.env.POSTGRES_USER,
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
    host: 'yamabiko.proxy.rlwy.net',
    database: process.env.PGDATABASE || process.env.POSTGRES_DB,
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
