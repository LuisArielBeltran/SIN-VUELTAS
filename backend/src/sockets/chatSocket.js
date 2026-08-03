const jwt = require('jsonwebtoken');
const db = require('../config/db');

const configureSockets = (io) => {
    // Middleware de autenticación de Socket.io mediante JWT
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Autenticación fallida: Token no proporcionado.'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // Adjunta los datos del usuario al socket
            next();
        } catch (err) {
            next(new Error('Autenticación fallida: Token inválido o expirado.'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Usuario conectado al socket: ID ${socket.user.id}`);

        // Unir al usuario a una sala privada basada en su ID único
        socket.join(`user_${socket.user.id}`);

        // Escuchar el evento de envío de mensaje privado
        socket.on('private_message', async ({ receiverId, content }) => {
            try {
                if (!content || !receiverId) return;

                const senderId = socket.user.id;

                // Guardar el mensaje en la base de datos PostgreSQL
                const query = `
                    INSERT INTO messages (sender_id, receiver_id, content, created_at)
                    VALUES ($1, $2, $3, NOW())
                    RETURNING id, sender_id, receiver_id, content, created_at;
                `;
                const { rows } = await db.query(query, [senderId, receiverId, content]);
                const savedMessage = rows[0];

                // Enviar el mensaje en tiempo real al destinatario si está conectado
                io.to(`user_${receiverId}`).emit('new_message', savedMessage);

                // Confirmar al emisor que su mensaje fue guardado y despachado
                socket.emit('message_sent', savedMessage);

            } catch (error) {
                console.error('Error al procesar mensaje por socket:', error);
                socket.emit('socket_error', { error: 'No se pudo enviar el mensaje.' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Usuario desconectado: ID ${socket.user.id}`);
        });
    });
};

module.exports = configureSockets;