const jwt = require('jsonwebtoken');
const db = require('../config/db');

const configureSockets = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Autenticación fallida'));

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; 
            next();
        } catch (err) {
            next(new Error('Token inválido'));
        }
    });

    // Auto-asegurar que las columnas existan en la base de datos
    db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'text';`).catch(() => {});
    db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'offline';`).catch(() => {});

    io.on('connection', async (socket) => {
        console.log(`🔌 Usuario conectado: ID ${socket.user.id}`);
        socket.join(`user_${socket.user.id}`);

        // 1. Al conectar, marcar como "online"
        await db.query("UPDATE users SET status = 'online', last_seen = NOW() WHERE id = $1", [socket.user.id]);

        // 2. Escuchar cambios de estado (cuando la app se va a segundo plano o vuelve)
        socket.on('change_status', async (newStatus) => {
            if (['online', 'connected', 'offline'].includes(newStatus)) {
                await db.query("UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2", [newStatus, socket.user.id]);
            }
        });

        // 3. Escuchar envío de mensajes
        socket.on('private_message', async ({ receiverId, content, type }) => {
            try {
                if (!content || !receiverId) return;
                const senderId = socket.user.id;
                const messageType = type || 'text';

                const query = `
                    INSERT INTO messages (sender_id, receiver_id, content, type, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    RETURNING id, sender_id, receiver_id, content, type, created_at;
                `;
                const { rows } = await db.query(query, [senderId, receiverId, content, messageType]);
                
                io.to(`user_${receiverId}`).emit('new_message', rows[0]);
                socket.emit('message_sent', rows[0]);

            } catch (error) {
                console.error('Error al procesar mensaje:', error);
            }
        });

        // 4. Al desconectar (cerrar la app o perder internet), marcar como "offline"
        socket.on('disconnect', async () => {
            console.log(`🔌 Usuario desconectado: ID ${socket.user.id}`);
            await db.query("UPDATE users SET status = 'offline', last_seen = NOW() WHERE id = $1", [socket.user.id]);
        });
    });
};

module.exports = configureSockets;
