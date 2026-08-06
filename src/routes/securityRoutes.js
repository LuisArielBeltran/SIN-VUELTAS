const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const verifyToken = require('../middleware/auth'); // O el middleware auth que uses

router.post('/trust-device', verifyToken, securityController.trustDevice);
router.post('/verification/submit', verifyToken, securityController.submitVerification);

module.exports = router;
