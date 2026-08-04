const db = require('../config/db');

// 1. El usuario envía DNI (frente/dorso) y selfie -> Se verifica automáticamente al instante
const submitVerification = async (req, res) => {
    const userId = req.user.id;
    const { dni_front, dni_back, selfie } = req.body;

    if (!dni_front || !dni_back || !selfie) {
        return res.status(400).json({ error: 'Se requieren las dos caras del DNI y la selfie.' });
    }

    try {
        // Asignamos is_verified = TRUE de inmediato (Verificación Optimista)
        const query = `
            UPDATE users 
            SET dni_front = $1, 
                dni_back = $2, 
                selfie = $3, 
                is_verified = TRUE 
            WHERE id = $4 
            RETURNING id, username, is_verified;
        `;

        const { rows } = await db.query(query, [dni_front, dni_back, selfie, userId]);

        res.json({
            success: true,
            message: '¡Identidad verificada con éxito! Ya cuentas con la insignia dorada.',
            user: rows[0]
        });
    } catch (error) {
        console.error('Error al procesar la verificación:', error);
        res.status(500).json({ error: 'Error interno al procesar las imágenes de verificación.' });
    }
};

// 2. Panel Admin: Revocar/Desaprobar la verificación si las fotos no coinciden
const revokeVerification = async (req, res) => {
    // Aquí puedes asegurar que solo tú (o un rol admin) ejecute esta ruta si lo deseas
    const { targetUserId } = req.body; 

    if (!targetUserId) {
        return res.status(400).json({ error: 'ID de usuario requerido.' });
    }

    try {
        const query = `
            UPDATE users 
            SET is_verified = FALSE 
            WHERE id = $1 
            RETURNING id, username, is_verified;
        `;

        const { rows } = await db.query(query, [targetUserId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({
            success: true,
            message: `Verificación retirada silenciosamente al usuario ID: ${targetUserId}`,
            user: rows[0]
        });
    } catch (error) {
        console.error('Error al desaprobar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

module.exports = {
    submitVerification,
    revokeVerification
};
