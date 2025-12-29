// src/routes/sms.routes.js
const express = require('express');
const router = express.Router();
const smsController = require('../controllers/sms.controller');
const { authenticate, checkRole } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent authentification
router.use(authenticate);

// Routes publiques (conseiller+)
router.post('/send', checkRole(['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques']), smsController.sendSMS);
router.get('/logs', checkRole(['admin', 'dga', 'risques']), smsController.getLogs);
router.get('/stats', checkRole(['admin', 'dga', 'risques']), smsController.getStatistics);

// Routes admin seulement
router.post('/bulk', checkRole(['admin', 'dga']), smsController.sendBulkSMS);
router.post('/retry-failed', checkRole(['admin']), smsController.retryFailedSMS);
router.post('/test-providers', checkRole(['admin']), smsController.testProviders);

module.exports = router;