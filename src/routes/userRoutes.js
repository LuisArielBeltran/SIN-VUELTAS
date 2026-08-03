const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/auth');

// Obtener perfil propio (Requiere Token JWT)
router.get('/me', verifyToken, userController.getMyProfile);

// Actualizar perfil propio (Requiere Token JWT)
router.put('/me', verifyToken, userController.updateProfile);

module.exports = router;