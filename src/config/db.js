const { Pool } = require('pg');
require('dotenv').config();

// Forzamos el uso de las variables individuales que Railway provee con seguridad
const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

// Prueba rápida de diagnóstico en consola al arrancar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error crítico al conectar con PostgreSQL:', err.message);
    } else {
        console.log('✅ Base de datos conectada exitosamente a:', process.env.PGHOST);
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
