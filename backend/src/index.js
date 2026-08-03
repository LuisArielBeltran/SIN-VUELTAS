const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
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

// Montar rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// Configurar canal de WebSockets
configureSockets(io);

// 🧹 Tarea en segundo plano: Limpieza automática de mensajes con más de 6 meses
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

// Ejecutar limpieza al arrancar el servidor y programarla cada 24 horas
runMessageCleanup();
setInterval(runMessageCleanup, 24 * 60 * 60 * 1000);

// Ruta de estado del servidor
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        project: 'Sin Vueltas API', 
        version: '1.0.0' 
    });
});

// Arrancar el servidor unificado HTTP + WebSockets
server.listen(PORT, () => {
    console.log(`🚀 Servidor y WebSockets de Sin Vueltas corriendo en el puerto ${PORT}`);
});