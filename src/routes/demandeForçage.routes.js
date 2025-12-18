const express = require('express');
const router = express.Router();
const demandeController = require('../controllers/demandeForçage.controller');
const { uploadMultiple } = require('../middlewares/upload');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission, requireAuthorizationLimit } = require('../middlewares/permission.middleware');
const { auditLogger } = require('../middlewares/audit.middleware');

// IMPORT CORRIGÉ DU MIDDLEWARE DE NOTIFICATIONS
let notificationMiddleware;
try {
  notificationMiddleware = require('../middlewares/notification.middleware');
  console.log('✅ Middleware de notifications chargé');
} catch (error) {
  console.log('⚠️ Middleware de notifications non trouvé, création de stub');
  // Middleware stub en cas d'erreur
  notificationMiddleware = {
    autoNotify: () => (req, res, next) => {
      console.log('📝 Middleware autoNotify stub');
      next();
    },
    unreadCountMiddleware: () => (req, res, next) => next(),
    notificationCleanup: () => (req, res, next) => next()
  };
}

const { autoNotify, unreadCountMiddleware } = notificationMiddleware;

const {
  createDemandeValidator,
  updateStatutValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// Middleware pour les notifications non lues (sur toutes les routes)
router.use(unreadCountMiddleware());

// ==================== ROUTES CLIENT ====================

// Créer une demande
router.post('/',
  authenticate, 
  requirePermission('CREATE_DEMANDE'),
  auditLogger('creation', 'demande'),
  uploadMultiple,
  // createDemandeValidator, // Commenté car problème avec form-data
  autoNotify('demande_creation', 'demande'),
  demandeController.creerDemande
);

// Lister mes demandes
router.get('/', 
  authenticate, 
  requirePermission('VIEW_OWN_DEMANDE'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_list'),
  demandeController.listerDemandes
);

// Voir une demande
router.get('/:id', 
  authenticate, 
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande'),
  demandeController.getDemande
);

// Soumettre une demande
router.patch('/:id/soumettre', 
  authenticate, 
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('soumission', 'demande'),
  autoNotify('demande_soumission', 'demande'),
  demandeController.soumettreDemande
);

// Annuler une demande
router.patch('/:id/annuler', 
  authenticate, 
  requirePermission('CANCEL_OWN_DEMANDE'),
  auditLogger('annulation', 'demande'),
  autoNotify('demande_annulation', 'demande'),
  demandeController.annulerDemande
);

// Modifier une demande
router.put('/:id', 
  authenticate, 
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('modification', 'demande'),
  autoNotify('demande_modification', 'demande'),
  demandeController.mettreAJourDemande
);

// ==================== ROUTES CONSEILLER/ÉQUIPE ====================

// Demandes de l'équipe
router.get('/team/demandes', 
  authenticate, 
  requirePermission('VIEW_TEAM_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_team'),
  demandeController.listerDemandes
);

// ==================== ROUTES AGENCE (RM/DCE/ADG) ====================

// Demandes de l'agence
router.get('/agency/demandes', 
  authenticate, 
  requirePermission('VIEW_AGENCY_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_agency'),
  demandeController.listerDemandes
);

// ==================== ROUTES ADMIN/TOUTES LES DEMANDES ====================

// Toutes les demandes (DGA, Admin, Risques)
router.get('/all/demandes', 
  authenticate, 
  requirePermission('VIEW_ALL_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_all'),
  demandeController.listerDemandes
);

// Statistiques
router.get('/statistics', 
  authenticate, 
  requirePermission('VIEW_STATISTICS'),
  auditLogger('consultation', 'statistiques'),
  demandeController.getStatistiques
);

// Exporter les données (TODO: implémenter exporterDemandes)
// router.get('/export', 
//   authenticate, 
//   requirePermission('EXPORT_DATA'),
//   auditLogger('export', 'demandes'),
//   demandeController.exporterDemandes
// );

// ==================== ROUTES TRAITEMENT ====================

// Traiter une demande (valider/refuser)
router.patch('/:id/traiter', 
  authenticate, 
  requirePermission('PROCESS_DEMANDE'),
  requireAuthorizationLimit, // Vérifier la limite d'autorisation
  updateStatutValidator,
  auditLogger('traitement', 'demande'),
  autoNotify('demande_traitement', 'demande'),
  demandeController.traiterDemande
);

// Remonter une demande
router.patch('/:id/escalate', 
  authenticate, 
  requirePermission('ESCALATE_DEMANDE'),
  auditLogger('remontee', 'demande'),
  autoNotify('demande_remontee', 'demande'),
  demandeController.remonterDemande
);

// Régulariser une demande
router.patch('/:id/regulariser', 
  authenticate, 
  requirePermission('PROCESS_DEMANDE'),
  auditLogger('regularisation', 'demande'),
  autoNotify('demande_regularisation', 'demande'),
  demandeController.regulariser
);

// ==================== ROUTES DE NOTIFICATIONS (AJOUTÉES) ====================

// Marquer une notification comme lue pour une demande
router.patch('/:id/notifications/read', 
  authenticate,
  requirePermission('VIEW_OWN_DEMANDE'),
  async (req, res) => {
    try {
      const Notification = require('../models/Notification');
      const { id: demandeId } = req.params;
      
      // Marquer toutes les notifications liées à cette demande comme lues
      await Notification.updateMany(
        {
          utilisateur: req.user.id,
          entite: 'demande',
          entiteId: demandeId,
          lue: false
        },
        {
          $set: {
            lue: true,
            lueAt: new Date()
          }
        }
      );
      
      res.json({
        success: true,
        message: 'Notifications marquées comme lues'
      });
      
    } catch (error) {
      console.error('❌ Erreur marquage notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage des notifications'
      });
    }
  }
);

// Récupérer les notifications d'une demande
router.get('/:id/notifications', 
  authenticate,
  requirePermission('VIEW_OWN_DEMANDE'),
  async (req, res) => {
    try {
      const Notification = require('../models/Notification');
      const { id: demandeId } = req.params;
      const { limit = 20 } = req.query;
      
      const notifications = await Notification.find({
        utilisateur: req.user.id,
        entite: 'demande',
        entiteId: demandeId
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
      
      res.json({
        success: true,
        data: {
          demandeId,
          notifications,
          count: notifications.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des notifications'
      });
    }
  }
);

module.exports = router;