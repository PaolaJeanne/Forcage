// routes/admin/risks.routes.js
const express = require('express');
const router = express.Router();
const risksController = require('../../controllers/risks.controller');
const { authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../constants/roles');

// Autorisations pour les risques
const allowRiskRoles = authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RISQUES, ROLES.RM, ROLES.DCE);

// Récupérer les statistiques des risques
router.get('/statistics', allowRiskRoles, risksController.getStatistics);

// Récupérer la liste des risques
router.get('/', allowRiskRoles, risksController.getAllRisks);

// Récupérer un risque spécifique
router.get('/:riskId', allowRiskRoles, risksController.getRiskById);

// Créer un nouveau risque
router.post('/', allowRiskRoles, risksController.createRisk);

// Mettre à jour un risque
router.put('/:riskId', allowRiskRoles, risksController.updateRisk);

// Supprimer un risque
router.delete('/:riskId', authorize(ROLES.ADMIN, ROLES.RISQUES), risksController.deleteRisk);

// Exporter les risques
router.get('/export', allowRiskRoles, risksController.exportRisks);

module.exports = router;
