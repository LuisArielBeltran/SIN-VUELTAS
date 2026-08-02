const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la Base de Datos con Railway
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Servir la carpeta frontend de forma limpia
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta de estado
app.get('/api/status', (req, res) => {
    res.json({ mensaje: "Motor de Sin Vueltas funcionando al 100%" });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
