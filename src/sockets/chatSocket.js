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

    // Auto-asegurar que la columna 'type' exista en la tabla messages de PostgreSQL
    db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'text';`).catch(err => {
        console.error('Aviso de esquema messages (type):', err.message);
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Usuario conectado al socket: ID ${socket.user.id}`);

        // Unir al usuario a una sala privada basada en su ID único
        socket.join(`user_${socket.user.id}`);

        // Escuchar el evento de envío de mensaje privado (Soporta texto y fotos efímeras)
        socket.on('private_message', async ({ receiverId, content, type }) => {
            try {
                if (!content || !receiverId) return;

                const senderId = socket.user.id;
                const messageType = type || 'text';

                // Guardar el mensaje en la base de datos PostgreSQL incluyendo su tipo
                const query = `
                    INSERT INTO messages (sender_id, receiver_id, content, type, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    RETURNING id, sender_id, receiver_id, content, type, created_at;
                `;
                const { rows } = await db.query(query, [senderId, receiverId, content, messageType]);
                const savedMessage = rows[0];

                // Enviar el mensaje en tiempo real a la sala privada del destinatario
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
