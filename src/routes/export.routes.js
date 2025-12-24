
// ============================================
// src/routes/export.routes.js
// ============================================
const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');

router.use(authenticate);

// Exporter une demande
router.get('/demande/:id/pdf',
  requirePermission('VIEW_DEMANDE'),
  exportController.exporterDemande
);

// Exporter les statistiques
router.get('/statistiques/pdf',
  requirePermission('VIEW_ANALYTICS'),
  exportController.exporterStatistiques
);

module.exports = router;