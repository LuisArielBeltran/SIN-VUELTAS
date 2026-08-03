const express = require('express');
const router = express.Router();
const radarController = require('../controllers/radarController');
const verifyToken = require('../middleware/auth');

// Ruta para actualizar la geolocalización del usuario con ruido de privacidad
router.post('/location', verifyToken, radarController.updateLocation);

// Ruta para buscar usuarios cercanos en el radar utilizando PostGIS
router.get('/nearby', verifyToken, radarController.getNearbyUsers);

module.exports = router;