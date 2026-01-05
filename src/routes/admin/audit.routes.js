// routes/admin/audit.routes.js
const express = require('express');
const router = express.Router();
const auditController = require('../../controllers/audit.controller');
const { authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../constants/roles');

// Autorisations spécifiques
const allowAuditRoles = authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RISQUES);

// Récupérer les logs d'audit
router.get('/logs', allowAuditRoles, auditController.getAllLogs);

// Récupérer les statistiques d'audit
router.get('/statistics', allowAuditRoles, auditController.getStatistics);

// Récupérer l'historique d'une entité
router.get('/entity/:entityType/:entityId', allowAuditRoles, auditController.getEntityHistory);

// Récupérer l'historique d'un utilisateur
router.get('/user/:userId', allowAuditRoles, auditController.getUserHistory);

// Exporter les logs (admin uniquement)
router.get('/export', authorize(ROLES.ADMIN), auditController.exportLogs);

// Nettoyer les anciens logs (admin uniquement)
router.delete('/clean', authorize(ROLES.ADMIN), auditController.cleanOldLogs);

module.exports = router;
