const db = require('../config/db');

// 1. Obtener la lista de conversaciones activas del usuario
const getConversations = async (req, res) => {
    const userId = req.user.id;

    try {
        // Consulta para obtener el último mensaje y con quién se está chateando
        const query = `
            SELECT DISTINCT ON (partner_id)
                CASE 
                    WHEN sender_id = $1 THEN receiver_id 
                    ELSE sender_id 
                END AS partner_id,
                u.username AS partner_username,
                u.profile_image AS partner_profile_image,
                m.content AS last_message,
                m.created_at AS last_message_time
            FROM messages m
            JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
            WHERE m.sender_id = $1 OR m.receiver_id = $1
            ORDER BY partner_id, m.created_at DESC;
        `;

        const { rows } = await db.query(query, [userId]);

        res.json({
            success: true,
            conversations: rows
        });
    } catch (error) {
        console.error('Error al obtener conversaciones:', error);
        res.status(500).json({ error: 'Error interno al cargar las conversaciones.' });
    }
};

// 2. Obtener el historial de mensajes con un usuario específico
const getMessagesWithUser = async (req, res) => {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    try {
        const query = `
            SELECT id, sender_id, receiver_id, content, created_at
            FROM messages
            WHERE (sender_id = $1 AND receiver_id = $2)
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC;
        `;

        const { rows } = await db.query(query, [userId, otherUserId]);

        res.json({
            success: true,
            messages: rows
        });
    } catch (error) {
        console.error('Error al obtener el historial de mensajes:', error);
        res.status(500).json({ error: 'Error interno al cargar el historial.' });
    }
};

module.exports = {
    getConversations,
    getMessagesWithUser
};