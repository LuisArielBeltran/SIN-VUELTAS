const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar conexión a la base de datos
const db = require('./config/db');

// Importar enrutadores y sockets
const authRoutes = require('./routes/authRoutes');
const radarRoutes = require('./routes/radarRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const configureSockets = require('./sockets/chatSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// 1. Montar rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// 2. Ruta de estado de la API (movida para no bloquear el frontend)
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        project: 'Sin Vueltas API', 
        version: '1.0.0' 
    });
});

// 3. Configurar canal de WebSockets
configureSockets(io);

// 4. Tarea en segundo plano: Limpieza automática de mensajes con más de 6 meses
const runMessageCleanup = async () => {
    try {
        const query = `DELETE FROM messages WHERE created_at < NOW() - INTERVAL '6 months';`;
        const result = await db.query(query);
        if (result.rowCount > 0) {
            console.log(`🧹 [Limpieza Automática]: Se eliminaron ${result.rowCount} mensajes antiguos (> 6 meses).`);
        }
    } catch (error) {
        console.error('❌ Error al ejecutar la limpieza de mensajes:', error);
    }
};

runMessageCleanup();
setInterval(runMessageCleanup, 24 * 60 * 60 * 1000);

// 5. Servir archivos estáticos del Frontend (PWA) desde la carpeta /public
app.use(express.static(path.join(__dirname, '../public')));

// 6. SPA Fallback: Cualquier otra ruta dirige al index.html del frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Arrancar el servidor unificado HTTP + WebSockets + Frontend
server.listen(PORT, () => {
    console.log(`🚀 Servidor unificado de Sin Vueltas corriendo en el puerto ${PORT}`);
});
