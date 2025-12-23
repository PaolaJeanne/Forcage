// src/routes/demandeForçage.routes.js - VERSION CORRIGÉE AVEC IMPORT DES CONTRÔLEURS
const express = require('express');
const router = express.Router();

// Middlewares
const { uploadMultiple } = require('../middlewares/upload');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission, requireAuthorizationLimit } = require('../middlewares/permission.middleware');
const { auditLogger } = require('../middlewares/audit.middleware');

// IMPORT DES CONTRÔLEURS DEPUIS L'INDEX
const {
  creerDemande,
  listerDemandes,
  getDemande,
  soumettreDemande,
  annulerDemande,
  traiterDemande,
  remonterDemande,
  regulariser,
  getStatistiques,
  mettreAJourDemande
} = require('../controllers/index');

// Validators
const {
  createDemandeValidator,
  updateStatutValidator,
  listDemandesValidator
} = require('../validators/demandeForçage.validator');

// ==================== UTILITAIRES ====================

// Middleware de notifications avec fallback
function getNotificationMiddleware() {
  try {
    return require('../middlewares/notification.middleware');
  } catch (error) {

    return {
      autoNotify: () => (req, res, next) => {
        next();
      },
      unreadCountMiddleware: () => (req, res, next) => next(),
      notificationCleanup: () => (req, res, next) => next()
    };
  }
}

const notificationMiddleware = getNotificationMiddleware();

// Marquer les notifications comme lues
async function handleMarkNotificationsAsRead(req, res) {
  try {
    const Notification = require('../models/Notification');
    const { id: demandeId } = req.params;

    const result = await Notification.updateMany(
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
      message: 'Notifications marquées comme lues',
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage des notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Récupérer les notifications d'une demande
async function handleGetDemandeNotifications(req, res) {
  try {
    const Notification = require('../models/Notification');
    const { id: demandeId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find({
        utilisateur: req.user.id,
        entite: 'demande',
        entiteId: demandeId
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      Notification.countDocuments({
        utilisateur: req.user.id,
        entite: 'demande',
        entiteId: demandeId
      })
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        demandeId,
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ==================== MIDDLEWARES GLOBAUX ====================
router.use(authenticate);
router.use(notificationMiddleware.unreadCountMiddleware());

// ==================== ROUTES CLIENT ====================

// Créer une demande
router.post('/',
  requirePermission('CREATE_DEMANDE'),
  auditLogger('creation', 'demande'),
  uploadMultiple,
  // createDemandeValidator, // Commenté car problème avec form-data
  notificationMiddleware.autoNotify('demande_creation', 'demande'),
  creerDemande  // ← Utilisation directe de la fonction importée
);

// Lister mes demandes
router.get('/',
  requirePermission('VIEW_OWN_DEMANDE'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_list'),
  listerDemandes  // ← Utilisation directe de la fonction importée
);

// Voir une demande
router.get('/:id',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande'),
  getDemande  // ← Utilisation directe de la fonction importée
);

// Soumettre une demande
router.patch('/:id/soumettre',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('soumission', 'demande'),
  notificationMiddleware.autoNotify('demande_soumission', 'demande'),
  soumettreDemande  // ← Utilisation directe de la fonction importée
);

// Annuler une demande
router.patch('/:id/annuler',
  requirePermission('CANCEL_OWN_DEMANDE'),
  auditLogger('annulation', 'demande'),
  notificationMiddleware.autoNotify('demande_annulation', 'demande'),
  annulerDemande  // ← Utilisation directe de la fonction importée
);

// Modifier une demande
router.put('/:id',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('modification', 'demande'),
  notificationMiddleware.autoNotify('demande_modification', 'demande'),
  mettreAJourDemande  // ← Utilisation directe de la fonction importée
);

// ==================== ROUTES CONSEILLER/ÉQUIPE ====================

// Demandes de l'équipe
router.get('/team/demandes',
  requirePermission('VIEW_TEAM_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_team'),
  listerDemandes  // ← Utilisation directe de la fonction importée
);

// ==================== ROUTES AGENCE (RM/DCE/ADG) ====================

// Demandes de l'agence
router.get('/agency/demandes',
  requirePermission('VIEW_AGENCY_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_agency'),
  listerDemandes  // ← Utilisation directe de la fonction importée
);

// ==================== ROUTES ADMIN/TOUTES LES DEMANDES ====================

// Toutes les demandes (DGA, Admin, Risques)
router.get('/all/demandes',
  requirePermission('VIEW_ALL_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_all'),
  listerDemandes  // ← Utilisation directe de la fonction importée
);

// Statistiques
router.get('/statistics',
  requirePermission('VIEW_STATISTICS'),
  auditLogger('consultation', 'statistiques'),
  getStatistiques  // ← Utilisation directe de la fonction importée
);

// ==================== ROUTES TRAITEMENT ====================

// Traiter une demande (valider/refuser)
router.patch('/:id/traiter',
  requirePermission('PROCESS_DEMANDE'),
  requireAuthorizationLimit,
  updateStatutValidator,
  auditLogger('traitement', 'demande'),
  notificationMiddleware.autoNotify('demande_traitement', 'demande'),
  traiterDemande  // ← Utilisation directe de la fonction importée
);

// Remonter une demande
router.patch('/:id/escalate',
  requirePermission('ESCALATE_DEMANDE'),
  auditLogger('remontee', 'demande'),
  notificationMiddleware.autoNotify('demande_remontee', 'demande'),
  remonterDemande  // ← Utilisation directe de la fonction importée
);

// Régulariser une demande
router.patch('/:id/regulariser',
  requirePermission('PROCESS_DEMANDE'),
  auditLogger('regularisation', 'demande'),
  notificationMiddleware.autoNotify('demande_regularisation', 'demande'),
  regulariser  // ← Utilisation directe de la fonction importée
);

// ==================== ROUTES DE NOTIFICATIONS ====================

// Marquer une notification comme lue pour une demande
router.patch('/:id/notifications/read',
  requirePermission('VIEW_OWN_DEMANDE'),
  handleMarkNotificationsAsRead
);

// Récupérer les notifications d'une demande
router.get('/:id/notifications',
  requirePermission('VIEW_OWN_DEMANDE'),
  handleGetDemandeNotifications
);

// ==================== ROUTES UTILITAIRES ====================

// Vérifier l'état d'une demande
router.get('/:id/status',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande_status'),
  async (req, res) => {
    try {
      const DemandeForçage = require('../models/DemandeForçage');
      const demande = await DemandeForçage.findById(req.params.id)
        .select('statut numeroReference createdAt updatedAt dateEcheance clientId')
        .lean();

      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      // Vérifier les permissions
      if (req.user.role === 'client' && demande.clientId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      res.json({
        success: true,
        data: {
          statut: demande.statut,
          numeroReference: demande.numeroReference,
          createdAt: demande.createdAt,
          updatedAt: demande.updatedAt,
          joursRestants: demande.dateEcheance ?
            Math.ceil((new Date(demande.dateEcheance) - new Date()) / (1000 * 60 * 60 * 24)) : null
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// Obtenir les actions disponibles pour une demande
router.get('/:id/actions',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande_actions'),
  async (req, res) => {
    try {
      const DemandeForçage = require('../models/DemandeForçage');
      const WorkflowService = require('../services/workflow.service');

      const demande = await DemandeForçage.findById(req.params.id)
        .populate('clientId', 'notationClient')
        .select('statut montant clientId')
        .lean();

      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      // Vérifier les permissions
      if (req.user.role === 'client' && demande.clientId._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      const actions = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.clientId?.notationClient || 'C',
        req.user.role === 'client'
      );

      res.json({
        success: true,
        data: {
          actions,
          statutActuel: demande.statut,
          montant: demande.montant,
          notationClient: demande.clientId?.notationClient || 'C',
          roleUtilisateur: req.user.role
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// Health check des routes de demandes
router.get('/health',
  (req, res) => {
    res.json({
      success: true,
      message: 'Routes demandes opérationnelles',
      timestamp: new Date(),
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : null
    });
  }
);

module.exports = router;