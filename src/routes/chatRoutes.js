const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const verifyToken = require('../middleware/auth');

// Listar conversaciones activas
router.get('/conversations', verifyToken, chatController.getConversations);

// Obtener historial de mensajes con un usuario en específico
router.get('/messages/:otherUserId', verifyToken, chatController.getMessagesWithUser);

module.exports = router;