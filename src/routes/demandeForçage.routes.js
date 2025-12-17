// routes/demandeForçage.routes.js - VERSION CORRIGÉE
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

// IMPORT CRITIQUE - vérifiez que ça marche
console.log('🔍 [ROUTES] Chargement middleware notification...');
const notificationMiddleware = require('../middlewares/notification.middleware');
console.log('🔍 [ROUTES] Middleware chargé:', notificationMiddleware ? 'OK' : 'ERREUR');

const { autoNotify } = notificationMiddleware;

const {
  createDemandeValidator,
  updateStatutValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// ==================== ROUTES CLIENT ====================
router.post('/',
  authenticate, 
  requireClient,
  auditLogger('creation', 'demande'),
  uploadMultiple,
  createDemandeValidator,
  
  // DEBUG
  (req, res, next) => {
    console.log('🔍 [ROUTE DEBUG] Avant contrôleur');
    console.log('🔍 User ID:', req.user?.id);
    next();
  },
  
  demandeController.creerDemande,
  
  // DEBUG
  (req, res, next) => {
    console.log('🔍 [ROUTE DEBUG] Après contrôleur, avant autoNotify');
    next();
  },
  
  autoNotify('demande_creation', 'demande')
);

// Routes GET
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
  demandeController.soumettreDemande,
  autoNotify('demande_soumission', 'demande')
);

router.patch('/:id/annuler', 
  authenticate, 
  requireClient,
  auditLogger('annulation', 'demande'),
  demandeController.annulerDemande,
  autoNotify('demande_annulation', 'demande')
);

router.put('/:id', 
  authenticate, 
  requireClient,
  auditLogger('modification', 'demande'),
  demandeController.mettreAJourDemande,
  autoNotify('demande_modification', 'demande')
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
  demandeController.traiterDemande,
  autoNotify('demande_traitement', 'demande')
);

router.patch('/:id/remonter', 
  authenticate, 
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg'),
  auditLogger('remontee', 'demande'),
  demandeController.remonterDemande,
  autoNotify('demande_remontee', 'demande')
);

router.patch('/:id/regulariser', 
  authenticate, 
  authorize('conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'),
  auditLogger('regularisation', 'demande'),
  demandeController.regulariser,
  autoNotify('demande_regularisation', 'demande')
);

module.exports = router;