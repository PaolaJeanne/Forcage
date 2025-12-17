// routes/demandeForçage.routes.js - VERSION FINALE AVEC NOTIFICATIONS
const express = require('express');
const router = express.Router();
const demandeController = require('../controllers/demandeForçage.controller');
const { uploadMultiple } = require('../middlewares/upload');
const {
  authenticate,
  authorize,
  requireAdmin,
  requireManager,
  requireConseiller,
  requireClient
} = require('../middlewares/auth.middleware');
const { auditLogger } = require('../middlewares/audit.middleware');
const { autoNotify } = require('../middlewares/notification.middleware'); // ⭐ NOUVEAU

const {
  createDemandeValidator,
  updateStatutValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// ==================== ROUTES CLIENT ====================
router.post('/',
  authenticate, 
  requireClient, 
  uploadMultiple,
  auditLogger('creation', 'demande'),
  autoNotify('demande_creation', 'demande'), // ⭐ NOTIFICATION
  demandeController.creerDemande
);

router.get('/', 
  authenticate, 
  requireClient, 
  listDemandesValidator,
  auditLogger('consultation', 'demande_list'),
  demandeController.listerDemandes
);

router.get('/:id', 
  authenticate, 
  requireClient,
  auditLogger('consultation', 'demande'),
  demandeController.getDemande
);

router.patch('/:id/soumettre', 
  authenticate, 
  requireClient,
  auditLogger('soumission', 'demande'),
  autoNotify('demande_soumission', 'demande'), // ⭐ NOTIFICATION
  demandeController.soumettreDemande
);

router.patch('/:id/annuler', 
  authenticate, 
  requireClient,
  auditLogger('annulation', 'demande'),
  autoNotify('demande_annulation', 'demande'), // ⭐ NOTIFICATION
  demandeController.annulerDemande
);

router.put('/:id', 
  authenticate, 
  requireClient,
  auditLogger('modification', 'demande'),
  autoNotify('demande_modification', 'demande'), // ⭐ NOTIFICATION
  demandeController.mettreAJourDemande
);

// ==================== ROUTES CONSEILLER ====================
router.get('/conseiller/demandes', 
  authenticate, 
  requireConseiller, 
  listDemandesValidator,
  auditLogger('consultation', 'demande_conseiller'),
  demandeController.listerDemandes
);

// ==================== ROUTES RESPONSABLE (RM/DCE) ====================
router.get('/responsable/demandes', 
  authenticate, 
  requireManager, 
  listDemandesValidator,
  auditLogger('consultation', 'demande_responsable'),
  demandeController.listerDemandes
);

// ==================== ROUTES ADMIN/RISQUES ====================
router.get('/admin/statistiques', 
  authenticate, 
  requireAdmin,
  auditLogger('consultation', 'statistiques'),
  demandeController.getStatistiques
);

router.get('/admin/demandes', 
  authenticate, 
  requireAdmin, 
  listDemandesValidator,
  auditLogger('consultation', 'demande_admin'),
  demandeController.listerDemandes
);

// ==================== ROUTES TRAITEMENT ====================
router.patch('/:id/traiter', 
  authenticate, 
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'), 
  updateStatutValidator,
  auditLogger('traitement', 'demande'),
  autoNotify('demande_traitement', 'demande'), // ⭐ NOTIFICATION
  demandeController.traiterDemande
);

router.patch('/:id/remonter', 
  authenticate, 
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg'),
  auditLogger('remontee', 'demande'),
  autoNotify('demande_remontee', 'demande'), // ⭐ NOTIFICATION
  demandeController.remonterDemande
);

router.patch('/:id/regulariser', 
  authenticate, 
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'),
  auditLogger('regularisation', 'demande'),
  autoNotify('demande_regularisation', 'demande'), // ⭐ NOTIFICATION
  demandeController.regulariser
);

module.exports = router;