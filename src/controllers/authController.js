const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. Registro de usuario
const register = async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        return res.status(400).json({ error: 'Todos los campos (email, password, username) son obligatorios.' });
    }

    try {
        // Verificar si el correo ya está registrado
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }

        // Cifrar la contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Guardar en la base de datos
        const query = `
            INSERT INTO users (email, password_hash, username, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, email, username, created_at;
        `;
        const { rows } = await db.query(query, [email, passwordHash, username]);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito.',
            user: rows[0]
        });
    } catch (error) {
        console.error('Error en el registro:', error);
        res.status(500).json({ error: 'Error interno al registrar el usuario.' });
    }
};

// 2. Inicio de sesión
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
    }

    try {
        // Buscar el usuario por email
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const user = rows[0];

        // Validar contraseña
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // ==========================================
        // 🌟 TRUCO TEMPORAL PARA HACERTE PREMIUM 🌟
        // (Reemplaza 'tu_correo_de_prueba@email.com' por tu correo real)
        // ==========================================
        if (email === 'tu_correo_de_prueba@email.com') {
            await db.query('UPDATE users SET is_premium = TRUE WHERE email = $1', [email]);
            user.is_premium = true; 
        }

        // Generar Token JWT (expira en 7 días)
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                is_premium: user.is_premium || false
            }
        });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ error: 'Error interno al iniciar sesión.' });
    }
};

module.exports = {
    register,
    login
};
