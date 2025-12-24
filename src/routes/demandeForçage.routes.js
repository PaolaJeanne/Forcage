// src/routes/demandeForçage.routes.js - VERSION CORRIGÉE ET AMÉLIORÉE
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
    console.log('⚠️  Notification middleware non trouvé, utilisation fallback');
    return {
      autoNotify: () => (req, res, next) => next(),
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
    console.error('❌ Erreur marquage notifications:', error);
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
    console.error('❌ Erreur récupération notifications:', error);
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

/**
 * @route   POST /api/v1/demandes
 * @desc    Créer une nouvelle demande de forçage
 * @access  Private (Client)
 */
router.post('/',
  requirePermission('CREATE_DEMANDE'),
  auditLogger('creation', 'demande'),
  uploadMultiple,
  // createDemandeValidator, // Temporairement désactivé pour form-data
  notificationMiddleware.autoNotify('demande_creation', 'demande'),
  creerDemande
);

/**
 * @route   GET /api/v1/demandes
 * @desc    Lister mes demandes
 * @access  Private (Client)
 */
router.get('/',
  requirePermission('VIEW_OWN_DEMANDE'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_list'),
  listerDemandes
);

/**
 * @route   GET /api/v1/demandes/:id
 * @desc    Voir une demande spécifique
 * @access  Private (Client, Conseiller, RM, DCE, ADG, Admin, Risques)
 */
router.get('/:id',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande'),
  getDemande
);

/**
 * @route   PATCH /api/v1/demandes/:id/soumettre
 * @desc    Soumettre une demande (client → conseiller)
 * @access  Private (Client propriétaire)
 */
router.patch('/:id/soumettre',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('soumission', 'demande'),
  notificationMiddleware.autoNotify('demande_soumission', 'demande'),
  soumettreDemande
);

/**
 * @route   PATCH /api/v1/demandes/:id/annuler
 * @desc    Annuler une demande
 * @access  Private (Client propriétaire)
 */
router.patch('/:id/annuler',
  requirePermission('CANCEL_OWN_DEMANDE'),
  auditLogger('annulation', 'demande'),
  notificationMiddleware.autoNotify('demande_annulation', 'demande'),
  annulerDemande
);

/**
 * @route   PUT /api/v1/demandes/:id
 * @desc    Modifier une demande
 * @access  Private (Client propriétaire)
 */
router.put('/:id',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('modification', 'demande'),
  notificationMiddleware.autoNotify('demande_modification', 'demande'),
  mettreAJourDemande
);

// ==================== NOUVELLE ROUTE: PRISE EN CHARGE ====================

/**
 * @route   PATCH /api/v1/demandes/:id/prendre-en-charge
 * @desc    Conseiller prend en charge une demande
 * @access  Private (Conseiller)
 */
router.patch('/:id/prendre-en-charge',
  requirePermission('PROCESS_DEMANDE'),
  auditLogger('prise_en_charge', 'demande'),
  notificationMiddleware.autoNotify('demande_prise_en_charge', 'demande'),
  async (req, res) => {
    try {
      console.log('📝 Prise en charge demande:', req.params.id);
      
      const DemandeForçage = require('../models/DemandeForçage');
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Vérifier que c'est bien un conseiller
      if (userRole !== 'conseiller') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les conseillers peuvent prendre en charge des demandes'
        });
      }
      
      // Récupérer la demande
      const demande = await DemandeForçage.findById(id);
      
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }
      
      // Vérifier que la demande est en attente de conseiller
      if (demande.statut !== 'EN_ATTENTE_CONSEILLER') {
        return res.status(400).json({
          success: false,
          message: `Impossible de prendre en charge une demande avec le statut ${demande.statut}`
        });
      }
      
      // Mettre à jour la demande
      const ancienStatut = demande.statut;
      demande.statut = 'EN_ETUDE_CONSEILLER';
      demande.datePriseEnCharge = new Date();
      
      // Ajouter à l'historique
      demande.historiqueValidations = demande.historiqueValidations || [];
      demande.historiqueValidations.push({
        role: userRole,
        userId: userId,
        nom: req.user.nom || 'Conseiller',
        prenom: req.user.prenom || '',
        action: 'PRISE_EN_CHARGE',
        commentaire: 'Demande prise en charge pour étude',
        date: new Date(),
        ancienStatut,
        nouveauStatut: 'EN_ETUDE_CONSEILLER'
      });
      
      await demande.save();
      
      console.log(`✅ Demande ${demande.numeroReference} prise en charge`);
      
      res.json({
        success: true,
        message: 'Demande prise en charge avec succès',
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            ancienStatut,
            nouveauStatut: demande.statut,
            datePriseEnCharge: demande.datePriseEnCharge
          },
          conseiller: {
            id: userId,
            nom: req.user.nom,
            prenom: req.user.prenom
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur prise en charge:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la prise en charge',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ==================== ROUTES CONSEILLER/ÉQUIPE ====================

/**
 * @route   GET /api/v1/demandes/team/demandes
 * @desc    Lister les demandes de l'équipe
 * @access  Private (Conseiller, RM, DCE, ADG, Admin, Risques)
 */
router.get('/team/demandes',
  requirePermission('VIEW_TEAM_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_team'),
  listerDemandes
);

// ==================== ROUTES AGENCE (RM/DCE/ADG) ====================

/**
 * @route   GET /api/v1/demandes/agency/demandes
 * @desc    Lister les demandes de l'agence
 * @access  Private (RM, DCE, ADG, Admin, Risques)
 */
router.get('/agency/demandes',
  requirePermission('VIEW_AGENCY_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_agency'),
  listerDemandes
);

// ==================== ROUTES ADMIN/TOUTES LES DEMANDES ====================

/**
 * @route   GET /api/v1/demandes/all/demandes
 * @desc    Lister toutes les demandes
 * @access  Private (DCE, ADG, DGA, Risques, Admin)
 */
router.get('/all/demandes',
  requirePermission('VIEW_ALL_DEMANDES'),
  listDemandesValidator,
  auditLogger('consultation', 'demande_all'),
  listerDemandes
);

/**
 * @route   GET /api/v1/demandes/statistics
 * @desc    Obtenir les statistiques des demandes
 * @access  Private (RM, DCE, ADG, DGA, Risques, Admin)
 */
router.get('/statistics',
  requirePermission('VIEW_STATISTICS'),
  auditLogger('consultation', 'statistiques'),
  getStatistiques
);

// ==================== ROUTES TRAITEMENT ====================

/**
 * @route   PATCH /api/v1/demandes/:id/traiter
 * @desc    Traiter une demande (valider/refuser)
 * @access  Private (Conseiller, RM, DCE, ADG, Admin, Risques)
 */
router.patch('/:id/traiter',
  requirePermission('PROCESS_DEMANDE'),
  requireAuthorizationLimit,
  updateStatutValidator,
  auditLogger('traitement', 'demande'),
  notificationMiddleware.autoNotify('demande_traitement', 'demande'),
  traiterDemande
);

/**
 * @route   PATCH /api/v1/demandes/:id/escalate
 * @desc    Remonter une demande au niveau supérieur
 * @access  Private (Conseiller, RM, DCE, ADG, Admin)
 */
router.patch('/:id/escalate',
  requirePermission('ESCALATE_DEMANDE'),
  auditLogger('remontee', 'demande'),
  notificationMiddleware.autoNotify('demande_remontee', 'demande'),
  remonterDemande
);

/**
 * @route   PATCH /api/v1/demandes/:id/regulariser
 * @desc    Régulariser une demande (marquer comme remboursée)
 * @access  Private (Conseiller, RM, DCE, ADG, Admin, Risques)
 */
router.patch('/:id/regulariser',
  requirePermission('PROCESS_DEMANDE'),
  auditLogger('regularisation', 'demande'),
  notificationMiddleware.autoNotify('demande_regularisation', 'demande'),
  regulariser
);

// ==================== ROUTES DE NOTIFICATIONS ====================

/**
 * @route   PATCH /api/v1/demandes/:id/notifications/read
 * @desc    Marquer les notifications d'une demande comme lues
 * @access  Private (Propriétaire de la demande)
 */
router.patch('/:id/notifications/read',
  requirePermission('VIEW_OWN_DEMANDE'),
  handleMarkNotificationsAsRead
);

/**
 * @route   GET /api/v1/demandes/:id/notifications
 * @desc    Récupérer les notifications d'une demande
 * @access  Private (Propriétaire de la demande)
 */
router.get('/:id/notifications',
  requirePermission('VIEW_OWN_DEMANDE'),
  handleGetDemandeNotifications
);

// ==================== ROUTES UTILITAIRES ====================

/**
 * @route   GET /api/v1/demandes/:id/status
 * @desc    Vérifier l'état d'une demande
 * @access  Private (Propriétaire de la demande)
 */
router.get('/:id/status',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande_status'),
  async (req, res) => {
    try {
      console.log('🔍 Vérification statut demande:', req.params.id);
      
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

      // Calculer les jours restants
      let joursRestants = null;
      if (demande.dateEcheance) {
        const maintenant = new Date();
        const echeance = new Date(demande.dateEcheance);
        const diffMs = echeance - maintenant;
        joursRestants = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        // Si la date est passée, valeur négative
        if (joursRestants < 0) joursRestants = 0;
      }

      res.json({
        success: true,
        data: {
          statut: demande.statut,
          numeroReference: demande.numeroReference,
          createdAt: demande.createdAt,
          updatedAt: demande.updatedAt,
          dateEcheance: demande.dateEcheance,
          joursRestants,
          estEnRetard: joursRestants !== null && joursRestants <= 0
        }
      });

    } catch (error) {
      console.error('❌ Erreur vérification statut:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

/**
 * @route   GET /api/v1/demandes/:id/actions
 * @desc    Obtenir les actions disponibles pour une demande
 * @access  Private (Propriétaire de la demande ou membre équipe)
 */
router.get('/:id/actions',
  requirePermission('VIEW_OWN_DEMANDE'),
  auditLogger('consultation', 'demande_actions'),
  async (req, res) => {
    try {
      console.log('🔧 Récupération actions pour demande:', req.params.id);
      
      const DemandeForçage = require('../models/DemandeForçage');
      const WorkflowService = require('../services/workflow.service');

      // Récupérer la demande avec toutes les infos nécessaires
      const demande = await DemandeForçage.findById(req.params.id)
        .populate('clientId', 'notationClient')
        .populate('conseillerId', 'nom prenom role')
        .select('statut montant clientId conseillerId typeOperation dateEcheance')
        .lean();

      if (!demande) {
        console.log('❌ Demande non trouvée:', req.params.id);
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      console.log('📊 Infos demande:', {
        id: demande._id,
        statut: demande.statut,
        montant: demande.montant,
        notation: demande.clientId?.notationClient,
        roleUtilisateur: req.user.role,
        estProprietaire: demande.clientId?._id.toString() === req.user.id
      });

      // Vérifier les permissions d'accès
      const isOwner = demande.clientId?._id.toString() === req.user.id;
      const isConseiller = demande.conseillerId?._id.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'dga';
      
      // Client ne peut voir que ses propres demandes
      if (req.user.role === 'client' && !isOwner) {
        console.log('❌ Accès refusé: client ne peut voir que ses demandes');
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à cette demande'
        });
      }

      // Récupérer les actions disponibles via WorkflowService
      const actions = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant || 0,
        demande.clientId?.notationClient || 'C',
        isOwner
      );

      console.log('✅ Actions disponibles:', actions);

      // Formater la réponse
      const response = {
        success: true,
        data: {
          actions: actions.filter(action => action !== null && action !== undefined),
          statutActuel: demande.statut,
          montant: demande.montant,
          notationClient: demande.clientId?.notationClient || 'C',
          roleUtilisateur: req.user.role,
          estProprietaire: isOwner,
          estConseillerAssigné: isConseiller,
          detailsDemande: {
            typeOperation: demande.typeOperation,
            dateEcheance: demande.dateEcheance
          }
        }
      };

      // Si c'est un conseiller et la demande est EN_ATTENTE_CONSEILLER, 
      // il DOIT d'abord la prendre en charge
      if (req.user.role === 'conseiller' && demande.statut === 'EN_ATTENTE_CONSEILLER') {
        response.data.message = "Cette demande nécessite une prise en charge avant traitement";
        response.data.actionRequis = "PRENDRE_EN_CHARGE";
      }

      res.json(response);

    } catch (error) {
      console.error('❌ Erreur route actions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des actions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ==================== WORKFLOW ROUTES (INTÉGRATION) ====================

/**
 * @route   PATCH /api/v1/demandes/:id/valider
 * @desc    Valider une demande (workflow)
 * @access  Private (Conseiller, RM, DCE, ADG, Admin, Risques)
 */
router.patch('/:id/valider',
  requirePermission('VALIDATE_DEMANDE'),
  auditLogger('validation', 'demande'),
  notificationMiddleware.autoNotify('demande_validation', 'demande'),
  async (req, res) => {
    try {
      console.log('✅ Validation workflow appelée pour demande:', req.params.id);
      
      // Essayez d'utiliser le workflow.controller s'il existe
      try {
        const workflowController = require('../controllers/workflow.controller');
        return workflowController.valider(req, res);
      } catch (error) {
        console.log('⚠️  workflow.controller non trouvé, utilisation fallback');
        
        // Fallback simple
        const DemandeForçage = require('../models/DemandeForçage');
        const { id } = req.params;
        const { commentaire } = req.body;
        
        const demande = await DemandeForçage.findById(id);
        if (!demande) {
          return res.status(404).json({
            success: false,
            message: 'Demande non trouvée'
          });
        }
        
        demande.statut = 'APPROUVEE';
        demande.dateApprobation = new Date();
        demande.approuveePar = req.user.id;
        
        if (commentaire) {
          demande.historiqueValidations = demande.historiqueValidations || [];
          demande.historiqueValidations.push({
            role: req.user.role,
            userId: req.user.id,
            nom: req.user.nom || 'Utilisateur',
            prenom: req.user.prenom || '',
            action: 'VALIDATION',
            commentaire,
            date: new Date()
          });
        }
        
        await demande.save();
        
        res.json({
          success: true,
          message: 'Demande validée avec succès',
          data: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            statut: demande.statut,
            dateApprobation: demande.dateApprobation
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur validation workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/demandes/:id/rejeter
 * @desc    Rejeter une demande (workflow)
 * @access  Private (Conseiller, RM, DCE, ADG, Admin, Risques)
 */
router.patch('/:id/rejeter',
  requirePermission('REFUSE_DEMANDE'),
  auditLogger('rejet', 'demande'),
  notificationMiddleware.autoNotify('demande_rejet', 'demande'),
  async (req, res) => {
    try {
      console.log('❌ Rejet workflow appelé pour demande:', req.params.id);
      
      // Essayez d'utiliser le workflow.controller s'il existe
      try {
        const workflowController = require('../controllers/workflow.controller');
        return workflowController.rejeter(req, res);
      } catch (error) {
        console.log('⚠️  workflow.controller non trouvé, utilisation fallback');
        
        // Fallback simple
        const DemandeForçage = require('../models/DemandeForçage');
        const { id } = req.params;
        const { motif } = req.body;
        
        if (!motif) {
          return res.status(400).json({
            success: false,
            message: 'Le motif de rejet est obligatoire'
          });
        }
        
        const demande = await DemandeForçage.findById(id);
        if (!demande) {
          return res.status(404).json({
            success: false,
            message: 'Demande non trouvée'
          });
        }
        
        demande.statut = 'REJETEE';
        demande.dateRejet = new Date();
        demande.rejeteePar = req.user.id;
        demande.motifRejet = motif;
        
        demande.historiqueValidations = demande.historiqueValidations || [];
        demande.historiqueValidations.push({
          role: req.user.role,
          userId: req.user.id,
          nom: req.user.nom || 'Utilisateur',
          prenom: req.user.prenom || '',
          action: 'REJET',
          commentaire: motif,
          date: new Date()
        });
        
        await demande.save();
        
        res.json({
          success: true,
          message: 'Demande rejetée',
          data: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            statut: demande.statut,
            motifRejet: demande.motifRejet
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur rejet workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du rejet',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/demandes/:id/remonter
 * @desc    Remonter une demande (workflow)
 * @access  Private (Conseiller, RM, DCE, ADG, Admin)
 */
router.patch('/:id/remonter',
  requirePermission('ESCALATE_DEMANDE'),
  auditLogger('remontee', 'demande'),
  notificationMiddleware.autoNotify('demande_remontee', 'demande'),
  async (req, res) => {
    try {
      console.log('⬆️  Remontée workflow appelée pour demande:', req.params.id);
      
      // Essayez d'utiliser le workflow.controller s'il existe
      try {
        const workflowController = require('../controllers/workflow.controller');
        return workflowController.remonter(req, res);
      } catch (error) {
        console.log('⚠️  workflow.controller non trouvé, utilisation fallback');
        
        // Fallback simple
        const DemandeForçage = require('../models/DemandeForçage');
        const { id } = req.params;
        const { commentaire } = req.body;
        
        const demande = await DemandeForçage.findById(id);
        if (!demande) {
          return res.status(404).json({
            success: false,
            message: 'Demande non trouvée'
          });
        }
        
        // Logique simple de remontée
        let nouveauStatut = demande.statut;
        let message = '';
        
        switch (demande.statut) {
          case 'EN_ETUDE_CONSEILLER':
            nouveauStatut = 'EN_ATTENTE_RM';
            message = 'Remontée au RM';
            break;
          case 'EN_ATTENTE_RM':
            nouveauStatut = 'EN_ATTENTE_DCE';
            message = 'Remontée au DCE';
            break;
          case 'EN_ATTENTE_DCE':
            nouveauStatut = 'EN_ATTENTE_ADG';
            message = 'Remontée à l\'ADG';
            break;
          default:
            return res.status(400).json({
              success: false,
              message: `Impossible de remonter depuis le statut ${demande.statut}`
            });
        }
        
        demande.statut = nouveauStatut;
        
        if (commentaire) {
          demande.historiqueValidations = demande.historiqueValidations || [];
          demande.historiqueValidations.push({
            role: req.user.role,
            userId: req.user.id,
            nom: req.user.nom || 'Utilisateur',
            prenom: req.user.prenom || '',
            action: 'REMONTEE',
            commentaire: commentaire || message,
            date: new Date()
          });
        }
        
        await demande.save();
        
        res.json({
          success: true,
          message: 'Demande remontée',
          data: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            ancienStatut: demande.statut,
            nouveauStatut,
            message
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur remontée workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la remontée',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ==================== HEALTH CHECK ====================

/**
 * @route   GET /api/v1/demandes/health
 * @desc    Health check des routes de demandes
 * @access  Public (avec authentification)
 */
router.get('/health',
  (req, res) => {
    res.json({
      success: true,
      message: 'Routes demandes opérationnelles',
      timestamp: new Date().toISOString(),
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : 'Non authentifié',
      endpoints: [
        'POST    /api/v1/demandes - Créer une demande',
        'GET     /api/v1/demandes - Lister mes demandes',
        'GET     /api/v1/demandes/:id - Voir une demande',
        'PATCH   /api/v1/demandes/:id/soumettre - Soumettre',
        'PATCH   /api/v1/demandes/:id/annuler - Annuler',
        'PATCH   /api/v1/demandes/:id/prendre-en-charge - Prise en charge',
        'PATCH   /api/v1/demandes/:id/valider - Valider',
        'PATCH   /api/v1/demandes/:id/rejeter - Rejeter',
        'PATCH   /api/v1/demandes/:id/remonter - Remonter',
        'GET     /api/v1/demandes/:id/actions - Actions disponibles'
      ]
    });
  }
);

module.exports = router;