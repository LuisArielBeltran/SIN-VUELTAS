const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
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

// Middleware de autenticación JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
}

// 1. Montar rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// Endpoint para recuperar el historial de chat entre el usuario actual y un destinatario
app.get('/api/messages/:recipientId', authenticateToken, async (req, res) => {
    try {
        const myId = req.user.id;
        const recipientId = req.params.recipientId;

        const query = `
            SELECT sender_id, receiver_id, content, created_at 
            FROM messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC
        `;
        
        const result = await db.query(query, [myId, recipientId]);
        
        res.json({ success: true, messages: result.rows });
    } catch (err) {
        console.error('❌ Error al obtener historial de mensajes:', err);
        res.status(500).json({ success: false, error: 'Error al cargar el historial' });
    }
});

// 2. Ruta de estado de la API
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

// 5. Servir archivos estáticos del Frontend (PWA)
app.use(express.static(path.join(__dirname, '../public')));

// 6. SPA Fallback (Siempre al final para no interferir con las rutas API)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Arrancar el servidor unificado HTTP + WebSockets + Frontend
server.listen(PORT, () => {
    console.log(`🚀 Servidor unificado de Sin Vueltas corriendo en el puerto ${PORT}`);
});
