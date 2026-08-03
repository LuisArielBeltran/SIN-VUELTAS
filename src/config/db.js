const { Pool } = require('pg');
require('dotenv').config();

// Construimos la URL limpia usando tu PGPASSWORD y el proxy público de Railway
const password = process.env.PGPASSWORD || '';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@yamabiko.proxy.rlwy.net:51338/railway`;

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Indispensable para conexiones externas seguras
    }
});

// Prueba de diagnóstico al arrancar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error crítico al conectar con PostgreSQL:', err.message);
    } else {
        console.log('✅ Base de datos conectada exitosamente a través del proxy público.');
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
