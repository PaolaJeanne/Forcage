const express = require('express');
const router = express.Router();
const demandeController = require('../controllers/demandeForçage.controller');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createDemandeValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// Routes CLIENT
router.post(
  '/',
  authenticate,
  createDemandeValidator,
  demandeController.creerDemande
);

router.get(
  '/',
  authenticate,
  listDemandesValidator,
  demandeController.listerDemandes
);

router.get(
  '/statistiques',
  authenticate,
  demandeController.getStatistiques
);

router.get(
  '/:id',
  authenticate,
  demandeController.getDemande
);

router.patch(
  '/:id/soumettre',
  authenticate,
  demandeController.soumettreDemande
);

router.patch(
  '/:id/annuler',
  authenticate,
  demandeController.annulerDemande
);

// Routes CONSEILLER/RESPONSABLE
router.patch(
  '/:id/traiter',
  authenticate,
  demandeController.traiterDemande
);

router.patch(
  '/:id/regulariser',
  authenticate,
  demandeController.regulariser
);

module.exports = router;