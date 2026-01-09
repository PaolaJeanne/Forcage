// src/routes/demandeForçage.routes.js
const express = require('express');
const router = express.Router();
const demandeController = require('../controllers/demandeForçage.controller');
const { uploadMultiple } = require('../middlewares/upload.middleware');
const {
  authenticate,
  authorize,
  requireAdmin,
  requireManager
} = require('../middlewares/auth.middleware');

const {
  updateStatutValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// ==================== ROUTES SPÉCIALES (AVANT LES ROUTES PARAMÉTRÉES) ====================

// Statistiques - DOIT ÊTRE AVANT /:id POUR ÉVITER LA CONFUSION
// ✅ CORRIGÉ: Ajouter 'client' pour que les clients puissent voir leurs propres statistiques
router.get('/statistics',
  authenticate,
  authorize('client', 'admin', 'dga', 'rm', 'dce', 'conseiller', 'adg', 'risques'),
  demandeController.getStatistiques
);

// Demandes de l'agence
router.get('/agency/demandes',
  authenticate,
  requireManager,
  listDemandesValidator,
  demandeController.listerDemandes
);

// Toutes les demandes (DGA, Admin, Risques, RM, DCE, ADG, Conseiller)
router.get('/all/demandes',
  authenticate,
  authorize('admin', 'dga', 'risques', 'rm', 'dce', 'adg', 'conseiller'),
  listDemandesValidator,
  demandeController.listerDemandes
);

// ==================== ROUTES CLIENT & CONSEILLER ====================

// Créer une demande avec fichiers
router.post('/',
  authenticate,
  authorize('client', 'conseiller'),
  uploadMultiple,
  demandeController.creerDemande
);

// Lister mes demandes (ou toutes les demandes pour admin)
router.get('/',
  authenticate,
  authorize('client', 'conseiller', 'admin', 'dga', 'rm', 'dce', 'adg', 'risques'),
  listDemandesValidator,
  demandeController.listerDemandes
);

// Voir une demande
router.get('/:id',
  authenticate,
  authorize('client', 'conseiller', 'admin', 'dga', 'rm', 'dce', 'adg', 'risques'),
  demandeController.getDemande
);

// Soumettre une demande
router.patch('/:id/soumettre',
  authenticate,
  authorize('client', 'conseiller'),
  demandeController.soumettreDemande
);

// Annuler une demande
router.patch('/:id/annuler',
  authenticate,
  authorize('client', 'conseiller'),
  demandeController.annulerDemande
);

// Modifier une demande
router.put('/:id',
  authenticate,
  authorize('client', 'conseiller'),
  demandeController.mettreAJourDemande
);

// ==================== ROUTES TRAITEMENT ====================

// Traiter une demande (valider/refuser)
router.patch('/:id/traiter',
  authenticate,
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'),
  updateStatutValidator,
  demandeController.traiterDemande
);

// Remonter une demande
router.patch('/:id/remonter',
  authenticate,
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg'),
  demandeController.remonterDemande
);

// Régulariser une demande
router.patch('/:id/regulariser',
  authenticate,
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'),
  demandeController.regulariser
);

module.exports = router;
