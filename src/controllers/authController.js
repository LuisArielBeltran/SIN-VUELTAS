const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// Inicializar Resend con tu llave (La pondremos en las variables de entorno de Railway)
const resend = new Resend(process.env.RESEND_API_KEY);

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

        // --- NUEVO: Enviar correo de bienvenida con Resend ---
        try {
            await resend.emails.send({
                from: 'Sin Vueltas <onboarding@resend.dev>', // Cambia esto cuando verifiques tu propio dominio en Resend
                to: email,
                subject: '¡Bienvenido a Sin Vueltas! 🚀',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #090d16; color: #f8fafc; border-radius: 10px;">
                        <h2 style="color: #3b82f6;">Hola, ${username}</h2>
                        <p>Tu cuenta en <strong>Sin Vueltas</strong> ha sido creada con éxito.</p>
                        <p>Recuerda que para acceder a todas las funciones y al chat sin límites, deberás validar tu identidad desde la aplicación.</p>
                        <br>
                        <p style="font-size: 12px; color: #64748b;">El equipo de Sin Vueltas.</p>
                    </div>
                `
            });
            console.log(`✉️ Correo de bienvenida enviado a: ${email}`);
        } catch (emailError) {
            console.error('⚠️ Error al enviar el correo con Resend:', emailError);
            // No detenemos el registro si el correo falla, simplemente lo registramos en consola
        }

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
                username: user.username
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
