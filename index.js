const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la Base de Datos (Railway te dará esta URL automáticamente)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario para Railway
});

// Servir los archivos estáticos del Frontend (La ilusión de PWA)
app.use(express.static(path.join(__ান্তর, '../frontend')));

// Ruta de prueba para verificar que el servidor vive
app.get('/api/status', (req, res) => {
    res.json({ mensaje: "Motor de Sin Vueltas funcionando al 100%" });
});

// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});