const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const SECRET_KEY = "sin_vueltas_secreto_super_seguro"; // Clave para los Tokens JWT

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Permitir fotos en base64 grandes
// Servir la carpeta 'public' (donde está tu index.html)
app.use(express.static(path.join(__dirname, 'public'))); 

// --- BASE DE DATOS EN MEMORIA (MVP temporal) ---
const users = {}; // Guarda usuarios { id, email, password, username, is_premium, is_verified, profile_image, lat, lng, status }
const messages = {}; // Guarda los chats privados
let userIdCounter = 1;

// --- MIDDLEWARE DE AUTENTICACIÓN ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
}

// ==========================================
// RUTAS API REST (Para conectarse al Frontend)
// ==========================================

// 1. Registro
app.post('/api/auth/register', (req, res) => {
    const { email, password, username } = req.body;
    if (Object.values(users).find(u => u.email === email)) {
        return res.status(400).json({ error: 'El correo ya está registrado' });
    }
    
    const newUser = {
        id: userIdCounter++, email, password, username,
        is_premium: false, is_verified: false, status: 'offline', profile_image: ''
    };
    users[newUser.id] = newUser;
    res.json({ success: true, message: 'Usuario registrado con éxito' });
});

// 2. Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = Object.values(users).find(u => u.email === email && u.password === password);
    
    if (!user) return res.status(400).json({ error: 'Credenciales incorrectas' });
    
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
    user.status = 'online';
    res.json({ token, user: { id: user.id, username: user.username } });
});

// 3. Obtener Mi Perfil
app.get('/api/users/me', authenticateToken, (req, res) => {
    const user = users[req.user.id];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true, user: { id: user.id, username: user.username, is_premium: user.is_premium, is_verified: user.is_verified, profile_image: user.profile_image } });
});

// 4. Actualizar Foto de Perfil
app.put('/api/users/me', authenticateToken, (req, res) => {
    if (users[req.user.id]) {
        users[req.user.id].profile_image = req.body.profile_image;
        res.json({ success: true });
    }
});

// 5. Enviar Ubicación GPS
app.post('/api/radar/location', authenticateToken, (req, res) => {
    if (users[req.user.id]) {
        users[req.user.id].lat = req.body.latitude;
        users[req.user.id].lng = req.body.longitude;
        res.json({ success: true });
    }
});

// 6. Obtener Usuarios Cercanos (El Radar)
app.get('/api/radar/nearby', authenticateToken, (req, res) => {
    const me = users[req.user.id];
    const nearbyUsers = Object.values(users)
        .filter(u => u.id !== me.id) // No incluirme a mi mismo
        .map(u => ({
            id: u.id, username: u.username, profile_image: u.profile_image,
            status: u.status, is_premium: u.is_premium, is_verified: u.is_verified,
            distance_km: (Math.random() * 2) + 0.1 // Distancia simulada para el MVP
        }));
    
    res.json({ success: true, count: nearbyUsers.length, isPremium: me.is_premium, users: nearbyUsers });
});

// 7. Simular Verificación con IA
app.post('/api/verification/submit', authenticateToken, (req, res) => {
    // Aquí a futuro conectaremos el Punto 6 (Gemini). Por ahora aprobamos automáticamente.
    if (users[req.user.id]) {
        users[req.user.id].is_verified = true;
        res.json({ success: true, message: 'Identidad validada por IA. ¡Insignia dorada activada!' });
    }
});

// ==========================================
// WEB-SOCKETS (Chat en Tiempo Real)
// ==========================================
const socketUsers = {}; // Mapea userId con socketId

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return next(new Error("Error de autenticación"));
        socket.userId = decoded.id;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ID ${socket.userId}`);
    socketUsers[socket.userId] = socket.id;
    if(users[socket.userId]) users[socket.userId].status = 'online';

    // Manejar cambio de estado (Ej: cuando minimiza la app)
    socket.on('change_status', (status) => {
        if(users[socket.userId]) users[socket.userId].status = status;
    });

    // Recibir y enviar mensaje privado (texto o foto efímera)
    socket.on('private_message', ({ receiverId, content, type }) => {
        const receiverSocketId = socketUsers[receiverId];
        
        // Guardar en historial de memoria
        const chatId = [socket.userId, receiverId].sort().join('_');
        if (!messages[chatId]) messages[chatId] = [];
        const newMsg = { id: Date.now(), sender_id: socket.userId, content, type, created_at: new Date() };
        messages[chatId].push(newMsg);

        // Si el receptor está online, enviárselo al instante
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_message', newMsg);
        }
    });

    socket.on('disconnect', () => {
        delete socketUsers[socket.userId];
        if(users[socket.userId]) users[socket.userId].status = 'desconectado';
    });
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor Sin Vueltas corriendo en http://localhost:${PORT}`);
});
