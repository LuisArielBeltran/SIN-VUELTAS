const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Ruta simple de prueba para verificar que el servidor online responde
app.get('/', (req, res) => {
    res.send("📍 Servidor de Sin Vueltas funcionando correctamente en Railway!");
});

app.get('/api/status', (req, res) => {
    res.json({ mensaje: "Motor de Sin Vueltas activo" });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
