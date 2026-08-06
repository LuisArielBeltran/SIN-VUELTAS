const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Tu Client ID de Google Console

// 1. Registro tradicional (Establece 30 días de prueba para el radar de 50km)
const register = async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    try {
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO users (email, password_hash, username, created_at, trial_ends_at)
            VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '30 days')
            RETURNING id, email, username, created_at;
        `;
        const { rows } = await db.query(query, [email, passwordHash, username]);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito. Disfrutas de 30 días de radar ampliado (50km).',
            user: rows[0]
        });
    } catch (error) {
        console.error('Error en el registro:', error);
        res.status(500).json({ error: 'Error interno al registrar el usuario.' });
    }
};

// 2. Login tradicional
const login = async (loginReq, loginRes) => {
    const { email, password } = loginReq.body;

    if (!email || !password) {
        return loginRes.status(400).json({ error: 'Email y contraseña son obligatorios.' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0) return loginRes.status(401).json({ error: 'Credenciales inválidas.' });

        const user = rows[0];
        if (!user.password_hash) {
            return loginRes.status(401).json({ error: 'Esta cuenta utiliza acceso con Google. Inicia sesión con Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return loginRes.status(401).json({ error: 'Credenciales inválidas.' });

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        loginRes.json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            token,
            user: { id: user.id, email: user.email, username: user.username }
        });
    } catch (error) {
        console.error('Error en el login:', error);
        loginRes.status(500).json({ error: 'Error interno al iniciar sesión.' });
    }
};

// 3. Login / Registro Rápido con Google
const googleLogin = async (req, res) => {
    const { credential } = req.body; // El token JWT que envía Google desde el frontend

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name } = payload;

        // Verificar si el usuario ya existe en PostgreSQL
        let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        let user;

        if (result.rows.length === 0) {
            // Si no existe, lo creamos automáticamente con 30 días de prueba
            const insertQuery = `
                INSERT INTO users (email, username, created_at, trial_ends_at, status)
                VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days', 'online')
                RETURNING id, email, username;
            `;
            const new뜸 = await db.query(insertQuery, [email, name]);
            user = new뜸.rows[0];
        } else {
            user = result.rows[0];
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Acceso con Google exitoso.',
            token,
            user: { id: user.id, email: user.email, username: user.username }
        });
    } catch (error) {
        console.error('Error en Google Auth:', error);
        res.status(400).json({ error: 'Token de Google inválido o expirado.' });
    }
};

module.exports = {
    register,
    login,
    googleLogin
};
