const db = require('../config/db');

// 1. Registrar y asegurar el dispositivo actual
const trustDevice = async (req, res) => {
    const userId = req.user.id;
    const { deviceInfo } = req.body; // Información técnica recopilada del navegador
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        // Guardar o actualizar registro del dispositivo confiable
        await db.query(
            'INSERT INTO trusted_devices (user_id, device_info, ip_address, created_at) VALUES ($1, $2, $3, NOW())',
            [userId, deviceInfo || 'Navegador Web Móvil', ipAddress]
        );

        res.json({
            success: true,
            message: 'Dispositivo registrado y asegurado correctamente.'
        });
    } catch (error) {
        console.error('Error al asegurar dispositivo:', error);
        res.status(500).json({ error: 'Error interno al registrar el dispositivo.' });
    }
};

// 2. Recibir fotos de DNI y Selfie para tu revisión manual
const submitVerification = async (req, res) => {
    const userId = req.user.id;
    const { dni_front, dni_back, selfie } = req.body;

    if (!dni_front || !dni_back || !selfie) {
        return res.status(400).json({ error: 'Las fotos de frente, dorso y selfie son obligatorias.' });
    }

    try {
        // Guardar las imágenes comprimidas en la base de datos y dejar is_verified en false hasta que tú lo apruebes
        const query = `
            UPDATE users 
            SET dni_front = $1, dni_back = $2, selfie = $3, is_verified = FALSE
            WHERE id = $4
        `;
        await db.query(query, [dni_front, dni_back, selfie, userId]);

        res.json({
            success: true,
            message: 'Documentación enviada con éxito. Un administrador revisará tus datos pronto para activar tu insignia dorada.'
        });
    } catch (error) {
        console.error('Error al enviar verificación:', error);
        res.status(500).json({ error: 'Error al procesar la verificación de identidad.' });
    }
};

module.exports = {
    trustDevice,
    submitVerification
};
