const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const verifyToken = require('../middleware/auth');

// Ruta para que el usuario envíe sus fotos y obtenga la verificación instantánea
router.post('/submit', verifyToken, verificationController.submitVerification);

// Ruta administrativa para revocar la verificación si detectas fraude
router.post('/revoke', verifyToken, verificationController.revokeVerification);

module.exports = router;
