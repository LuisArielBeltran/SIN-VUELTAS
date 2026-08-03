const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Acceso denegado. Token no proporcionado.' 
        });
    }

    // Extraer el token separando "Bearer" del valor real
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Formato de token no válido.' 
        });
    }

    try {
        // Verificar el token usando la clave secreta del entorno
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Adjunta los datos del usuario al objeto request
        next();
    } catch (error) {
        return res.status(403).json({ 
            error: 'Token inválido o expirado.' 
        });
    }
};

module.exports = verifyToken;