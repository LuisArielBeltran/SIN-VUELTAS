const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const securityRoutes = require('./routes/securityRoutes');

require('dotenv').config();

// Importar conexión a la base de datos
const db = require('./config/db');

// Importar enrutadores y sockets
const authRoutes = require('./routes/authRoutes');
const radarRoutes = require('./routes/radarRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const configureSockets = require('./sockets/chatSocket');
const verificationRoutes = require('./routes/verificationRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());

// FIX CRÍTICO: Ampliamos el límite de Express a 50mb. 
// Las fotos Base64 de la cámara pesan bastante y el servidor las rechazaba por defecto.
app.use(express.json({ limit: '50mb' }));

// Middleware de autenticación JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
}

// 1. Montar rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/security', securityRoutes);

// Endpoint para recuperar el historial de chat entre el usuario actual y un destinatario
app.get('/api/messages/:recipientId', authenticateToken, async (req, res) => {
    try {
        const myId = req.user.id;
        const recipientId = req.params.recipientId;

        const query = `
            SELECT id, sender_id, receiver_id, content, type, created_at 
            FROM messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC
        `;
        
        const result = await db.query(query, [myId, recipientId]);
        
        res.json({ success: true, messages: result.rows });
    } catch (err) {
        console.error('❌ Error al obtener historial de mensajes:', err);
        res.status(500).json({ success: false, error: 'Error al cargar el historial' });
    }
});

// FIX CRÍTICO: Nueva ruta POST para destruir el mensaje (POST evita bloqueos de red en celulares en comparación con DELETE)
app.post('/api/messages/destroy', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.body;
        
        if (!messageId) {
            return res.status(400).json({ success: false, error: 'ID de mensaje requerido' });
        }

        const query = `
            DELETE FROM messages 
            WHERE id = $1 AND (receiver_id = $2 OR sender_id = $2)
        `;
        const result = await db.query(query, [messageId, req.user.id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Mensaje no encontrado o sin permisos' });
        }

        res.json({ success: true, message: 'Mensaje destruido permanentemente de la base de datos.' });
    } catch (err) {
        console.error('❌ Error al destruir el mensaje efímero:', err);
        res.status(500).json({ success: false, error: 'Error al eliminar el mensaje.' });
    }
});

// FIX CRÍTICO 2: Endpoint de "rescate" por si el mensaje llega en vivo por webhooks y aún no tiene ID en el Frontend
// Ruta robusta para marcar como visto y destruir el contenido efímero en la BD
app.post('/api/messages/destroy', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.body;
        
        if (!messageId) {
            return res.status(400).json({ success: false, error: 'ID de mensaje requerido' });
        }

        // Actualizamos la fila en lugar de borrarla para evitar errores de ID o permisos
        const query = `
            UPDATE messages 
            SET viewed = TRUE, content = '[Destruido]' 
            WHERE id = $1 AND (receiver_id = $2 OR sender_id = $2)
        `;
        await db.query(query, [messageId, req.user.id]);

        res.json({ success: true, message: 'Mensaje marcado como visto y destruido en base de datos.' });
    } catch (err) {
        console.error('❌ Error al actualizar el mensaje efímero:', err);
        res.status(500).json({ success: false, error: 'Error al actualizar el mensaje.' });
    }
});

// 2. Ruta de estado de la API
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        project: 'Sin Vueltas API', 
        version: '1.0.0' 
    });
});

// 3. Configurar canal de WebSockets
configureSockets(io);

// --- MÓDULO DE SOPORTE Y ADMINISTRACIÓN ---

app.post('/api/support', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.length > 300) {
            return res.status(400).json({ success: false, error: 'El mensaje es obligatorio y no puede superar los 300 caracteres.' });
        }

        const userQuery = await db.query('SELECT username, email FROM users WHERE id = $1', [req.user.id]);
        if (userQuery.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        const { username, email } = userQuery.rows[0];

        await db.query(
            'INSERT INTO support_messages (user_id, name, email, message) VALUES ($1, $2, $3, $4)',
            [req.user.id, username, email, message]
        );

        res.json({ success: true, message: 'Mensaje de soporte enviado exitosamente.' });
    } catch (err) {
        console.error('❌ Error en soporte:', err);
        res.status(500).json({ success: false, error: 'Error interno al enviar soporte.' });
    }
});

async function verifyAdmin(req, res, next) {
    try {
        const userQuery = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (userQuery.rows.length === 0 || userQuery.rows[0].role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acceso denegado. Se requieren privilegios de administrador.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al verificar privilegios.' });
    }
}

app.get('/api/admin/metrics', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const totalUsers = await db.query('SELECT COUNT(*) FROM users');
        const premiumUsers = await db.query('SELECT COUNT(*) FROM users WHERE is_premium = TRUE');
        const freeUsers = await db.query('SELECT COUNT(*) FROM users WHERE is_premium = FALSE OR is_premium IS NULL');
        
        const connectedUsers = await db.query('SELECT COUNT(*) FROM users WHERE last_seen > NOW() - INTERVAL \'15 minutes\'');

        res.json({
            success: true,
            metrics: {
                total: parseInt(totalUsers.rows[0].count),
                connected: parseInt(connectedUsers.rows[0].count),
                offline: parseInt(totalUsers.rows[0].count) - parseInt(connectedUsers.rows[0].count),
                free: parseInt(freeUsers.rows[0].count),
                premium: parseInt(premiumUsers.rows[0].count)
            }
        });
    } catch (err) {
        console.error('❌ Error al obtener métricas:', err);
        res.status(500).json({ success: false, error: 'Error al calcular métricas.' });
    }
});

app.get('/api/admin/export-messages', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let query = `
            SELECT m.id, u1.username as sender, u2.username as receiver, m.content, m.created_at 
            FROM messages m
            JOIN users u1 ON m.sender_id = u1.id
            JOIN users u2 ON m.receiver_id = u2.id
        `;
        let params = [];

        if (startDate && endDate) {
            query += ` WHERE m.created_at BETWEEN $1 AND $2`;
            params = [startDate, endDate];
        }
        query += ` ORDER BY m.created_at DESC`;

        const result = await db.query(query, params);

        let htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Historial de Mensajes - Sin Vueltas</title></head>
            <body style='font-family: Arial, sans-serif;'>
                <h1 style='color: #2563eb;'>Reporte de Mensajes - Sin Vueltas</h1>
                <p><b>Rango de fechas:</b> ${startDate || 'Inicio'} al ${endDate || 'Actualidad'}</p>
                <hr/>
                <table border='1' cellspacing='0' cellpadding='5' style='border-collapse: collapse; width: 100%; font-size: 11px;'>
                    <tr style='background-color: #f3f4f6;'>
                        <th>ID</th><th>Remitente</th><th>Destinatario</th><th>Mensaje</th><th>Fecha y Hora</th>
                    </tr>
        `;

        result.rows.forEach(row => {
            htmlContent += `
                <tr>
                    <td>${row.id}</td>
                    <td><b>${row.sender}</b></td>
                    <td><b>${row.receiver}</b></td>
                    <td>${row.content}</td>
                    <td>${new Date(row.created_at).toLocaleString()}</td>
                </tr>
            `;
        });

        htmlContent += `</table></body></html>`;

        res.setHeader('Content-Type', 'application/vnd.ms-word');
        res.setHeader('Content-Disposition', `attachment; filename=reporte_mensajes_${Date.now()}.doc`);
        res.send(htmlContent);

    } catch (err) {
        console.error('❌ Error al exportar mensajes:', err);
        res.status(500).json({ success: false, error: 'Error al generar el documento Word.' });
    }
});

const runMessageCleanup = async () => {
    try {
        const query = `DELETE FROM messages WHERE created_at < NOW() - INTERVAL '6 months';`;
        const result = await db.query(query);
        if (result.rowCount > 0) {
            console.log(`🧹 [Limpieza Automática]: Se eliminaron ${result.rowCount} mensajes antiguos (> 6 meses).`);
        }
    } catch (error) {
        console.error('❌ Error al ejecutar la limpieza de mensajes:', error);
    }
};

runMessageCleanup();
setInterval(runMessageCleanup, 24 * 60 * 60 * 1000);

// 5. Servir archivos estáticos del Frontend (PWA)
app.use(express.static(path.join(__dirname, '../public')));

// 6. SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Arrancar el servidor unificado HTTP + WebSockets + Frontend
server.listen(PORT, () => {
    console.log(`🚀 Servidor unificado de Sin Vueltas corriendo en el puerto ${PORT}`);
});
