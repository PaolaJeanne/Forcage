// routes/demandeForçage.routes.js
const express = require('express');
const router = express.Router();
const demandeController = require('../controllers/demandeForçage.controller');
const {
  authenticate,
  authorize,
  requireAdmin,
  requireManager,
  requireConseiller,
  requireClient
} = require('../middleware/auth.middleware');

const {
  createDemandeValidator,
  updateStatutValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// ==================== ROUTES CLIENT ====================
router.post('/', authenticate, requireClient, createDemandeValidator, demandeController.creerDemande);
router.get('/', authenticate, requireClient, listDemandesValidator, demandeController.listerDemandes);
router.get('/:id', authenticate, requireClient, demandeController.getDemande);
router.patch('/:id/soumettre', authenticate, requireClient, demandeController.soumettreDemande);
router.patch('/:id/annuler', authenticate, requireClient, demandeController.annulerDemande);
router.put('/:id', authenticate, requireClient, demandeController.mettreAJourDemande);

// ==================== ROUTES CONSEILLER ====================
router.get('/conseiller/demandes', authenticate, requireConseiller, listDemandesValidator, demandeController.listerDemandes);
router.patch('/:id/traiter', authenticate, requireConseiller, updateStatutValidator, demandeController.traiterDemande);
router.patch('/:id/remonter', authenticate, requireConseiller, demandeController.remonterDemande);

// ==================== ROUTES RESPONSABLE (RM/DCE) ====================
router.get('/responsable/demandes', authenticate, requireManager, listDemandesValidator, demandeController.listerDemandes);
router.patch('/:id/traiter', authenticate, requireManager, updateStatutValidator, demandeController.traiterDemande);
router.patch('/:id/remonter', authenticate, requireManager, demandeController.remonterDemande);

// ==================== ROUTES ADMIN/RISQUES ====================
router.get('/admin/statistiques', authenticate, requireAdmin, demandeController.getStatistiques);
router.get('/admin/demandes', authenticate, requireAdmin, listDemandesValidator, demandeController.listerDemandes);
router.patch('/:id/regulariser', authenticate, requireAdmin, demandeController.regulariser);
router.patch('/:id/traiter', authenticate, requireAdmin, updateStatutValidator, demandeController.traiterDemande);

// ==================== ROUTES PARTAGÉES ====================
router.get('/:id', authenticate, demandeController.getDemande); // Permissions vérifiées dans le contrôleur
router.patch('/:id/regulariser', authenticate, demandeController.regulariser); // Permissions vérifiées dans le contrôleur

module.exports = router;