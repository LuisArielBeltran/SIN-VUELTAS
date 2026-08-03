const { Pool } = require('pg');
require('dotenv').config();

// Usamos directamente DATABASE_URL que Railway inyecta de forma nativa
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Indispensable para conexiones seguras en la nube
    }
});

// Prueba rápida de diagnóstico en consola al arrancar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error crítico al conectar con PostgreSQL:', err.message);
    } else {
        console.log('✅ Base de datos conectada exitosamente.');
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
