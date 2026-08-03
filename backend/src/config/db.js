const { Pool } = require('pg');
require('dotenv').config();

// Railway proporciona DATABASE_URL o variables individuales
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl: { rejectUnauthorized: false } // Requerido por PostgreSQL en la nube
          }
        : {
              user: process.env.PGUSER,
              host: process.env.PGHOST,
              database: process.env.PGDATABASE,
              password: process.env.PGPASSWORD,
              port: process.env.PGPORT || 5432,
              ssl: { rejectUnauthorized: false }
          }
);

module.exports = {
    query: (text, params) => pool.query(text, params),
};
