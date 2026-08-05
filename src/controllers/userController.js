const db = require('../config/db');

// 1. Obtener el perfil del usuario autenticado
const getMyProfile = async (req, res) => {
    const userId = req.user.id;

    try {
        // Incluimos 'is_verified' junto con 'is_premium'
        const query = `
            SELECT id, email, username, profile_image, latitude, longitude, is_premium, is_verified, created_at
            FROM users
            WHERE id = $1;
        `;
        const { rows } = await db.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({
            success: true,
            user: rows[0]
        });
    } catch (error) {
        console.error('Error al obtener el perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor al consultar el perfil.' });
    }
};

// 2. Actualizar datos del perfil (username, foto de perfil)
const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { username, profile_image } = req.body;

    try {
        // Incluimos 'is_verified' también en el RETURNING
        const query = `
            UPDATE users
            SET username = COALESCE($1, username),
                profile_image = COALESCE($2, profile_image)
            WHERE id = $3
            RETURNING id, email, username, profile_image, is_premium, is_verified;
        `;
        const { rows } = await db.query(query, [username, profile_image, userId]);

        res.json({
            success: true,
            message: 'Perfil actualizado con éxito.',
            user: rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
        res.status(500).json({ error: 'Error interno al actualizar el perfil.' });
    }
};

module.exports = {
    getMyProfile,
    updateProfile
};
