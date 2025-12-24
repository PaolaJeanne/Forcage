// src/controllers/workflow.controller.js - VERSION NOTIFICATIONS INTÉGRÉES
const DemandeForçage = require('../models/DemandeForçage');
const User = require('../models/User');
const AuditService = require('../services/audit.service');
const WorkflowIntegrator = require('../services/WorkflowIntegrator');
const WorkflowService = require('../services/workflow.service');
const WorkflowNotificationService = require('../services/workflowNotificationService');

class WorkflowController {

  /**
   * VALIDER une demande - AVEC NOTIFICATIONS
   */
  async valider(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;
      const userId = req.user.userId;

      // Récupérer la demande
      const demande = await DemandeForçage.findById(id)
        .populate('clientId', 'nom prenom notationClient')
        .populate('conseillerId', 'nom prenom role limiteAutorisation');

      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      // Récupérer l'utilisateur
      const user = await User.findById(userId);

      // Utiliser la logique métier existante
      const prochainStatut = WorkflowService.getNextStatus(
        'VALIDER',
        demande.statut,
        demande.montant,
        user.role,
        demande.clientId.notationClient || 'C',
        demande.agenceId
      );

      // Logique existante
      const ancienStatut = demande.statut;
      demande.statut = prochainStatut;
      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'VALIDATION',
        commentaire: commentaire || 'Validation',
        date: new Date()
      });

      if (prochainStatut === 'APPROUVEE') {
        demande.dateApprobation = new Date();
        demande.approuveePar = user._id;
      }

      await demande.save();

      // ========== NOTIFICATIONS AVANCÉES ==========
      await WorkflowNotificationService.notifierValidationDemande(
        demande,
        user,
        ancienStatut,
        prochainStatut
      );

      // ========== TRACKING WORKFLOW ==========
      await WorkflowIntegrator.logActionWithTrack(demande._id, {
        action: 'VALIDER',
        utilisateurId: user._id,
        roleUtilisateur: user.role,
        commentaire,
        fromStatut: ancienStatut,
        toStatut: prochainStatut
      });

      // ========== AUDIT ==========
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'VALIDER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          nouveauStatut: prochainStatut,
          montant: demande.montant
        },
        ip: req.ip
      });

      return res.json({
        success: true,
        message: `Demande validée (${ancienStatut} → ${prochainStatut})`,
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            statut: demande.statut,
            montant: demande.montant
          },
          validateur: {
            nom: user.nom,
            prenom: user.prenom,
            role: user.role
          }
        }
      });

    } catch (error) {
      console.error('Erreur validation:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * REJETER une demande - AVEC NOTIFICATIONS
   */
  async rejeter(req, res) {
    try {
      const { id } = req.params;
      const { motif } = req.body;
      const userId = req.user.userId;

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

      const user = await User.findById(userId);

      // Logique existante
      const ancienStatut = demande.statut;
      demande.statut = 'REJETEE';
      demande.dateRejet = new Date();
      demande.rejeteePar = user._id;
      demande.motifRejet = motif;

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'REJET',
        commentaire: motif,
        date: new Date()
      });

      await demande.save();

      // ========== NOTIFICATIONS AVANCÉES ==========
      await WorkflowNotificationService.notifierRejetDemande(demande, user, motif);

      // ========== TRACKING WORKFLOW ==========
      await WorkflowIntegrator.logActionWithTrack(demande._id, {
        action: 'REJETER',
        utilisateurId: user._id,
        roleUtilisateur: user.role,
        commentaire: motif,
        fromStatut: ancienStatut,
        toStatut: 'REJETEE'
      });

      // ========== AUDIT ==========
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'REJETER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          motifRejet: motif,
          montant: demande.montant
        },
        ip: req.ip
      });

      return res.json({
        success: true,
        message: 'Demande rejetée',
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            statut: demande.statut,
            motifRejet: motif
          },
          rejeteur: {
            nom: user.nom,
            prenom: user.prenom,
            role: user.role
          }
        }
      });

    } catch (error) {
      console.error('Erreur rejet:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du rejet',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * REMONTER une demande - AVEC NOTIFICATIONS
   */
  async remonter(req, res) {
    try {
      const { id } = req.params;
      const { commentaire, niveau } = req.body;
      const userId = req.user.userId;

      const demande = await DemandeForçage.findById(id);
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      const user = await User.findById(userId);

      // Déterminer le prochain niveau
      let nouveauStatut;
      if (niveau) {
        switch (niveau.toUpperCase()) {
          case 'RM':
            nouveauStatut = 'EN_ATTENTE_RM';
            break;
          case 'DCE':
            nouveauStatut = 'EN_ATTENTE_DCE';
            break;
          case 'ADG':
            nouveauStatut = 'EN_ATTENTE_ADG';
            break;
          case 'RISQUES':
            nouveauStatut = 'EN_ANALYSE_RISQUES';
            break;
          default:
            return res.status(400).json({
              success: false,
              message: 'Niveau invalide'
            });
        }
      } else {
        // Logique automatique
        switch (demande.statut) {
          case 'EN_ETUDE_CONSEILLER':
            nouveauStatut = 'EN_ATTENTE_RM';
            break;
          case 'EN_ATTENTE_RM':
            nouveauStatut = 'EN_ATTENTE_DCE';
            break;
          case 'EN_ATTENTE_DCE':
            nouveauStatut = 'EN_ATTENTE_ADG';
            break;
          default:
            return res.status(400).json({
              success: false,
              message: `Impossible de remonter depuis ${demande.statut}`
            });
        }
      }

      // Mettre à jour la demande
      const ancienStatut = demande.statut;
      demande.statut = nouveauStatut;

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'REMONTEE',
        commentaire: commentaire || `Remontée à ${nouveauStatut}`,
        date: new Date()
      });

      await demande.save();

      // ========== NOTIFICATIONS AVANCÉES ==========
      await WorkflowNotificationService.notifierRemonteeDemande(
        demande,
        user,
        niveau || nouveauStatut.split('_')[2], // Extraire le niveau du statut
        commentaire
      );

      // ========== TRACKING WORKFLOW ==========
      await WorkflowIntegrator.logActionWithTrack(demande._id, {
        action: 'REMONTER',
        utilisateurId: user._id,
        roleUtilisateur: user.role,
        commentaire,
        fromStatut: ancienStatut,
        toStatut: nouveauStatut
      });

      // ========== AUDIT ==========
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'REMONTER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          nouveauStatut
        },
        ip: req.ip
      });

      return res.json({
        success: true,
        message: `Demande remontée`,
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            ancienStatut,
            nouveauStatut
          }
        }
      });

    } catch (error) {
      console.error('Erreur remontée:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la remontée',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * NOUVELLE ROUTE : Vérifier les demandes en retard
   */
  async verifierDemandesEnRetard(req, res) {
    try {
      const user = await User.findById(req.user.userId);

      if (!['admin', 'dga', 'adg', 'risques'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      const demandesEnRetard = await WorkflowIntegrator.getDemandesEnRetard();

      // Notifier pour chaque demande en retard
      for (const track of demandesEnRetard) {
        const demande = await DemandeForçage.findById(track.demandeId);
        if (demande) {
          await WorkflowNotificationService.notifierDemandeEnRetard(demande);
        }
      }

      return res.json({
        success: true,
        message: `${demandesEnRetard.length} demandes en retard vérifiées`,
        count: demandesEnRetard.length,
        data: demandesEnRetard
      });

    } catch (error) {
      console.error('Erreur vérification retards:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification'
      });
    }
  }

  /**
   * NOUVELLE ROUTE : Assigner une demande
   */
  async assignerDemande(req, res) {
    try {
      const { id } = req.params;
      const { conseillerId } = req.body;
      const userId = req.user.userId;

      const demande = await DemandeForçage.findById(id);
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      const user = await User.findById(userId);
      const conseiller = await User.findById(conseillerId);

      if (!conseiller || conseiller.role !== 'conseiller') {
        return res.status(400).json({
          success: false,
          message: 'Utilisateur n\'est pas un conseiller'
        });
      }

      // Vérifier les permissions (admin, RM, ou conseiller lui-même)
      const peutAssigner = ['admin', 'rm'].includes(user.role) ||
        (user.role === 'conseiller' && demande.conseillerId?.toString() === user._id.toString());

      if (!peutAssigner) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission d\'assigner cette demande'
        });
      }

      const ancienConseiller = demande.conseillerId;
      demande.conseillerId = conseiller._id;

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'ASSIGNATION',
        commentaire: `Demande assignée à ${conseiller.prenom} ${conseiller.nom}`,
        date: new Date()
      });

      await demande.save();

      // ========== NOTIFICATION NOUVEAU CONSEILLER ==========
      await WorkflowNotificationService.notifierNouvelleDemandeAssignee(demande, conseiller);

      // ========== TRACKING WORKFLOW ==========
      await WorkflowIntegrator.logActionWithTrack(demande._id, {
        action: 'ASSIGNER',
        utilisateurId: user._id,
        roleUtilisateur: user.role,
        commentaire: `Assignation à ${conseiller.prenom} ${conseiller.nom}`,
        fromStatut: demande.statut,
        toStatut: demande.statut
      });

      return res.json({
        success: true,
        message: `Demande assignée à ${conseiller.prenom} ${conseiller.nom}`,
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            conseillerId: demande.conseillerId
          },
          ancienConseiller,
          nouveauConseiller: conseiller
        }
      });

    } catch (error) {
      console.error('Erreur assignation:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'assignation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * NOUVELLE ROUTE : Obtenir le tracking workflow d'une demande
   */
  async getWorkflowTrack(req, res) {
    try {
      const { id } = req.params;
      const track = await WorkflowIntegrator.getTrackByDemandeId(id);

      if (!track) {
        return res.status(404).json({
          success: false,
          message: 'Aucun tracking trouvé pour cette demande'
        });
      }

      return res.json({
        success: true,
        data: track
      });

    } catch (error) {
      console.error('Erreur récupération tracking:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du tracking'
      });
    }
  }

  /**
   * NOUVELLE ROUTE : Obtenir les demandes en retard
   */
  async getDemandesEnRetard(req, res) {
    try {
      const demandesEnRetard = await WorkflowIntegrator.getDemandesEnRetard();

      return res.json({
        success: true,
        count: demandesEnRetard.length,
        data: demandesEnRetard
      });

    } catch (error) {
      console.error('Erreur récupération demandes en retard:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des demandes en retard'
      });
    }
  }

  /**
   * NOUVELLE ROUTE : Obtenir les statistiques workflow
   */
  async getStatsWorkflow(req, res) {
    try {
      const stats = await WorkflowIntegrator.getWorkflowStats();

      return res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Erreur récupération stats workflow:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = new WorkflowController();