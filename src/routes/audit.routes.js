//src/routes/audit.routes.js

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent authentification + rôle approprié
router.use(authenticate);

// Consultation des logs (ADG, DGA, Risques, Admin)
router.get(
  '/logs',
  authorize('adg', 'dga', 'risques', 'admin'),
  auditController.getAllLogs
);

// Historique d'une entité spécifique
router.get(
  '/entity/:entite/:entiteId',
  authorize('rm', 'dce', 'adg', 'dga', 'risques', 'admin'),
  auditController.getEntityHistory
);

// Historique d'un utilisateur
router.get(
  '/user/:userId',
  authorize('dce', 'adg', 'dga', 'admin'),
  auditController.getUserHistory
);

// Statistiques d'audit
router.get(
  '/statistics',
  authorize('adg', 'dga', 'risques', 'admin'),
  auditController.getStatistics
);

// Exporter les logs
router.get(
  '/export',
  authorize('adg', 'dga', 'admin'),
  auditController.exportLogs
);

// Nettoyer les anciens logs (Admin uniquement)
router.delete(
  '/clean',
  authorize('admin'),
  auditController.cleanOldLogs
);

module.exports = router;
