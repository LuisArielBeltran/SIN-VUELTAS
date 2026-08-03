const { Pool } = require('pg');

// Inicializa el pool de conexiones usando la variable de entorno DATABASE_URL de Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('📦 Base de datos conectada correctamente (PostgreSQL + PostGIS)');
});

pool.on('error', (err) => {
  console.error('❌ Error crítico en el pool de PostgreSQL:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};