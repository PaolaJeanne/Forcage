// src/controllers/demandeForÃ§age.controller.js - VERSION CORRIGÃ‰E COMPLÃˆTE
const DemandeForÃ§ageService = require('../services/demandeForcage.service');
const WorkflowService = require('../services/workflow.service');
const NotificationService = require('../services/notification.service');
const {
  STATUTS_DEMANDE,
  ACTIONS_DEMANDE,
  PRIORITES,
  NOTATIONS_CLIENT,
  TYPES_OPERATION,
  SCORES_RISQUE
} = require('../constants/roles');
const { validationResult } = require('express-validator');
const { successResponse, errorResponse } = require('../utils/response.util');
const User = require('../models/User');

class DemandeForÃ§ageController {

  // ==================== MÃ‰THODES PUBLIQUES ====================

  /**
   * CrÃ©er une nouvelle demande
   */
  async creerDemande(req, res) {
    try {
      console.log('ðŸ“¥ CrÃ©ation demande - Body:', JSON.stringify(req.body, null, 2));
      console.log('ðŸ‘¤ User:', req.user);

      // VÃ©rification rÃ´le client
      if (req.user.role !== 'client') {
        return errorResponse(res, 403, 'Seuls les clients peuvent crÃ©er des demandes');
      }

      const {
        motif,
        motifDerogation,
        montant,
        typeOperation,
        dateEcheance,
        dureeExhaustive,
        tauxInteret,
        garanties,
        observations,
        compteDebit,
        compteNumero,
        devise,
        commentaireInterne
      } = req.body;

      // Validation
      const validation = this.validerDonneesCreation({
        motif: motif || motifDerogation,
        montant,
        typeOperation,
        dateEcheance
      });

      if (!validation.valid) {
        const logger = require('../utils/logger.util');
        logger.error('Validation Ã©chouÃ©e', { message: validation.message });
        return errorResponse(res, 400, validation.message);
      }

      // RÃ©cupÃ©rer client avec tous les champs nÃ©cessaires
      const client = await User.findById(req.user.id).select('+agencyId +agence +notationClient +classification +soldeActuel +decouvertAutorise +numeroCompte +cni +telephone');
      if (!client) {
        return errorResponse(res, 404, 'Client introuvable');
      }

      console.log('âœ… Client trouvÃ©:', {
        email: client.email,
        nom: `${client.prenom} ${client.nom}`
      });

      // Calculer montants
      const montantDemande = parseFloat(montant);
      const montantForÃ§ageTotal = this.calculerMontantForÃ§age(client, montantDemande);

      // Traiter fichiers
      const piecesJustificatives = this.traiterFichiersUpload(req.files);

      // Construire donnÃ©es demande
      const demandeData = await this.construireDonneesDemande({
        client,
        motif: motif || motifDerogation,
        montantDemande,
        typeOperation,
        montantForÃ§ageTotal,
        piecesJustificatives,
        dateEcheance: dureeExhaustive, // âœ… CORRIGÃ‰: Utiliser dureeExhaustive pour dateEcheance
        dureeExhaustive,
        tauxInteret,
        garanties: garanties || [], // âœ… CORRIGÃ‰: S'assurer que c'est un tableau
        observations,
        motifDerogation,
        compteDebit,
        compteNumero: compteNumero || client.numeroCompte,
        devise,
        commentaireInterne,
        user: req.user
      });

      console.log('ðŸ“¦ DonnÃ©es demande construites:', {
        ref: demandeData.numeroReference,
        montant: demandeData.montant,
        type: demandeData.typeOperation,
        priorite: demandeData.priorite
      });

      // CrÃ©er demande
      const DemandeForÃ§ageModel = this.getDemandeModel(); // âœ… CORRIGÃ‰: Renommer pour Ã©viter confusion
      const nouvelleDemande = await DemandeForÃ§ageModel.create(demandeData);

      // Peupler les informations client
      const demandePopulee = await DemandeForÃ§ageModel.findById(nouvelleDemande._id)
        .populate('clientId', 'nom prenom email telephone cni')
        .populate('conseillerId', 'nom prenom email');

      console.log('âœ… Demande crÃ©Ã©e avec ID:', demandePopulee._id);

      // Assigner conseiller
      try {
        await this.assignerConseillerAutomatique(demandePopulee._id, demandePopulee.agenceId);
        console.log('âœ… Conseiller assignÃ©');
      } catch (assignError) {
        console.warn('âš ï¸ Erreur assignation conseiller (non bloquante):', assignError.message);
      }

      // Notification (avec gestion d'erreur SSL)
      try {
        await this.notifierCreation(demandePopulee, req.user);
        console.log('âœ… Notification envoyÃ©e');
      } catch (notifError) {
        // Ne pas bloquer la crÃ©ation si l'email Ã©choue
        console.warn('âš ï¸ Erreur notification (non bloquante):', notifError.message);
        if (notifError.message && notifError.message.includes('SSL')) {
          console.warn('âš ï¸ Erreur SSL dÃ©tectÃ©e - Service email probablement mal configurÃ©');
        }
      }

      console.log('âœ… Demande crÃ©Ã©e avec succÃ¨s');

      // RÃ©ponse
      return successResponse(res, 201, 'Demande crÃ©Ã©e avec succÃ¨s', {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          statut: demandePopulee.statut,
          montant: demandePopulee.montant,
          typeOperation: demandePopulee.typeOperation,
          scoreRisque: demandePopulee.scoreRisque,
          priorite: demandePopulee.priorite,
          dateEcheance: demandePopulee.dateEcheance,
          piecesJustificatives: demandePopulee.piecesJustificatives,
          createdAt: demandePopulee.createdAt,
          clientNomComplet: `${demandePopulee.clientId.prenom} ${demandePopulee.clientId.nom}`
        },
        workflowInfo: {
          prochainesActions: WorkflowService.getAvailableActions(
            STATUTS_DEMANDE.BROUILLON,
            req.user.role,
            demandePopulee.montant,
            demandePopulee.notationClient,
            true
          ),
          statutActuel: STATUTS_DEMANDE.BROUILLON,
          responsable: WorkflowService.getResponsibleRole(STATUTS_DEMANDE.BROUILLON)
        }
      });

    } catch (error) {
      console.error('âŒ ERREUR CRÃ‰ATION DEMANDE:', error);
      console.error('Stack:', error.stack);

      // Message d'erreur plus dÃ©taillÃ©
      let errorMessage = 'Erreur lors de la crÃ©ation de la demande';
      let errorDetails = {};

      if (process.env.NODE_ENV === 'development') {
        errorMessage = error.message;
        errorDetails = { stack: error.stack };
      } else {
        errorDetails = {
          errorId: Date.now().toString(36),
          timestamp: new Date().toISOString()
        };
        console.error(`[Error ${errorDetails.errorId}]`, error.message);
      }

      return errorResponse(res, 500, errorMessage, errorDetails);
    }
  }

  /**
   * Lister les demandes selon le rÃ´le
   */
  async listerDemandes(req, res) {
    try {
      const logger = require('../utils/logger.util').child('DEMANDE_LIST');
      logger.header('LIST DEMANDES', 'ðŸ“‹');
      logger.request('GET', '/demandes', req.user);

      const filters = this.construireFiltres(req);
      const options = this.construireOptions(req);

      logger.debug('Filters applied:', filters);
      logger.debug('Options:', options);

      const result = await DemandeForÃ§ageService.listerDemandes(filters, options);
      logger.success(`Found ${result.demandes.length} demandes`, { total: result.pagination.total });

      // Adapter la rÃ©ponse
      const demandesAdaptees = await this.adapterReponseDemandes(result.demandes, req.user);

      // Ajouter actions disponibles
      const demandesAvecActions = demandesAdaptees.map(demande => ({
        ...demande,
        actionsDisponibles: this.getActionsDisponibles(demande, req.user)
      }));

      logger.response(200, 'Demandes listÃ©es');
      logger.footer();

      return successResponse(res, 200, 'Liste des demandes rÃ©cupÃ©rÃ©e', {
        demandes: demandesAvecActions,
        pagination: result.pagination,
        workflowDisponible: WorkflowService.getAvailableActions(
          null,
          req.user.role,
          null,
          'C'
        ),
        userRole: req.user.role,
        userEmail: req.user.email
      });

    } catch (error) {
      const logger = require('../utils/logger.util').child('DEMANDE_LIST');
      logger.error('Error listing demandes', error);
      logger.footer();
      return errorResponse(res, 500, 'Erreur serveur lors du listage des demandes', {
        message: error.message
      });
    }
  }

  /**
   * Consulter une demande spÃ©cifique
   */
  async getDemande(req, res) {
    try {
      const logger = require('../utils/logger.util').child('DEMANDE_GET');
      logger.header('GET DEMANDE', 'ðŸ”');
      logger.request('GET', `/demandes/${req.params.id}`, req.user);

      const demandeId = req.params.id;
      logger.debug('Demande ID:', { id: demandeId });

      const demande = await DemandeForÃ§ageService.getDemandeById(demandeId);

      if (!demande) {
        logger.warn('Demande not found', { id: demandeId });
        logger.footer();
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      logger.success('Demande found', { ref: demande.numeroReference });

      // VÃ©rifier permissions
      if (!this.verifierPermissionDemande(demande, req.user)) {
        logger.permission(false, `view_demande_${demandeId}`, req.user);
        logger.footer();
        return errorResponse(res, 403, 'AccÃ¨s non autorisÃ© Ã  cette demande');
      }

      logger.permission(true, `view_demande_${demandeId}`, req.user);

      // Formater rÃ©ponse
      const reponseFormatee = await this.formaterReponseDemande(demande, req.user);

      // Ajouter actions disponibles
      const isOwner = demande.clientId && demande.clientId._id.toString() === req.user.id;
      reponseFormatee.actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C',
        isOwner
      );

      // Informations workflow
      reponseFormatee.workflowInfo = {
        statutActuel: demande.statut,
        prochainesActions: reponseFormatee.actionsDisponibles,
        responsable: WorkflowService.getResponsibleRole(demande.statut),
        priorite: demande.priorite || 'NORMALE',
        delaiEstime: WorkflowService.calculatePriority(
          demande.dateEcheance || new Date(),
          demande.montant,
          demande.notationClient || 'C',
          demande.typeOperation
        )
      };

      logger.response(200, 'Demande retrieved');
      logger.footer();

      return successResponse(res, 200, 'DÃ©tails de la demande', {
        demande: reponseFormatee
      });

    } catch (error) {
      const logger = require('../utils/logger.util').child('DEMANDE_GET');
      logger.error('Error fetching demande', error);
      logger.footer();
      return errorResponse(res, 404, error.message || 'Demande non trouvÃ©e');
    }
  }

  /**
   * Soumettre une demande brouillon
   */
  async soumettreDemande(req, res) {
    try {
      const logger = require('../utils/logger.util');
      logger.info('Soumission demande', { id: req.params.id });

      const { id } = req.params;
      const { commentaire } = req.body || {};

      // RÃ©cupÃ©rer demande AVEC POPULATE
      const DemandeForÃ§ageModel = this.getDemandeModel();
      const demande = await DemandeForÃ§ageModel.findById(id)
        .populate('clientId', 'nom prenom email cni')
        .populate('conseillerId', 'nom prenom email');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      logger.success('Demande trouvÃ©e', { ref: demande.numeroReference });

      // VÃ©rifier permissions
      if (!this.peutSoumettreDemande(demande, req.user)) {
        logger.warn('Permission refusÃ©e pour soumission', { 
          userId: req.user.id, 
          demandeId: id 
        });
        return errorResponse(res, 403, 'Vous n\'Ãªtes pas autorisÃ© Ã  soumettre cette demande');
      }

      // DÃ©terminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.SOUMETTRE,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      logger.workflow('SOUMETTRE', demande.statut, nouveauStatut, {
        montant: demande.montant,
        role: req.user.role
      });

      // Mettre Ã  jour demande
      const updated = await this.mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.SOUMETTRE,
        req.user.id,
        commentaire || 'Demande soumise pour traitement',
        { dateSoumission: new Date() }
      );

      // Peupler les informations
      const demandePopulee = await DemandeForÃ§ageModel.findById(updated._id)
        .populate('clientId', 'nom prenom email cni')
        .populate('conseillerId', 'nom prenom email');

      // Assigner conseiller si nÃ©cessaire
      if (!demandePopulee.conseillerId) {
        try {
          await this.assignerConseillerAutomatique(demandePopulee._id, demandePopulee.agenceId);
        } catch (assignError) {
          logger.warn('Erreur assignation conseiller', assignError);
        }
      }

      // Notification (avec gestion d'erreur)
      try {
        await this.notifierSoumission(demandePopulee, req.user);
      } catch (notifError) {
        logger.warn('Erreur notification', notifError);
      }

      logger.success('Demande soumise avec succÃ¨s', { 
        ref: demandePopulee.numeroReference,
        statut: demandePopulee.statut 
      });

      return successResponse(res, 200, 'Demande soumise avec succÃ¨s', {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          statut: demandePopulee.statut,
          updatedAt: demandePopulee.updatedAt,
          conseiller: demandePopulee.conseillerId
        },
        workflowInfo: {
          prochainesActions: WorkflowService.getAvailableActions(
            nouveauStatut,
            'conseiller',
            demandePopulee.montant,
            demandePopulee.notationClient || 'C'
          ),
          responsable: WorkflowService.getResponsibleRole(nouveauStatut),
          delaiEstime: WorkflowService.calculatePriority(
            demandePopulee.dateEcheance || new Date(),
            demandePopulee.montant,
            demandePopulee.notationClient || 'C',
            demandePopulee.typeOperation
          )
        }
      });

    } catch (error) {
      const logger = require('../utils/logger.util');
      logger.error('ERREUR SOUMISSION', error);
      return errorResponse(res, 500, 'Erreur lors de la soumission de la demande', error.message);
    }
  }
    }
  }

  /**
   * Annuler une demande
   */
  async annulerDemande(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body || {};

      const DemandeForÃ§ageModel = this.getDemandeModel();
      const demande = await DemandeForÃ§ageModel.findById(id)
        .populate('clientId', 'nom prenom email cni');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      // VÃ©rifier permissions
      if (!this.peutAnnulerDemande(demande, req.user)) {
        return errorResponse(res, 403, 'Seul le client peut annuler sa demande');
      }

      // DÃ©terminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.ANNULER,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('ðŸ”„ Annulation:', demande.statut, '->', nouveauStatut);

      // Mettre Ã  jour
      const updated = await this.mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.ANNULER,
        req.user.id,
        commentaire || 'Demande annulÃ©e par le client',
        { dateAnnulation: new Date() }
      );

      // Peupler les informations
      const demandePopulee = await DemandeForÃ§ageModel.findById(updated._id)
        .populate('clientId', 'nom prenom email cni');

      // Notification
      try {
        await this.notifierAnnulation(demandePopulee, req.user);
      } catch (notifError) {
        console.warn('âš ï¸ Erreur notification:', notifError.message);
      }

      console.log('âœ… Demande annulÃ©e');

      return successResponse(res, 200, 'Demande annulÃ©e avec succÃ¨s', {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          statut: demandePopulee.statut,
          updatedAt: demandePopulee.updatedAt
        }
      });

    } catch (error) {
      console.error('âŒ Erreur annulation:', error);
      return errorResponse(res, 400, error.message || 'Erreur lors de l\'annulation');
    }
  }

  /**
   * Traiter une demande (validation, rejet, etc.)
   */
  async traiterDemande(req, res) {
    try {
      console.log('âš™ï¸ Traitement demande:', req.params.id);

      const { id } = req.params;
      const { action, commentaire, montantAutorise } = req.body;

      if (!action) {
        return errorResponse(res, 400, 'L\'action est requise (VALIDER, REJETER, etc.)');
      }

      // RÃ©cupÃ©rer demande
      const DemandeForÃ§ageModel = this.getDemandeModel();
      const demande = await DemandeForÃ§ageModel.findById(id)
        .populate('clientId', 'email nom prenom cni')
        .populate('conseillerId', 'email nom prenom');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      console.log('âœ… Demande trouvÃ©e:', demande.numeroReference);

      // VÃ©rifier actions disponibles
      const isOwner = demande.clientId && demande.clientId._id.toString() === req.user.id.toString();
      const actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C',
        isOwner
      );

      if (!actionsDisponibles.includes(action)) {
        return errorResponse(res, 403, `Action "${action}" non autorisÃ©e`, {
          details: {
            statutActuel: demande.statut,
            roleUtilisateur: req.user.role,
            actionsAutorisees: actionsDisponibles
          }
        });
      }

      // DÃ©terminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        action,
        demande.statut,
        montantAutorise || demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('ðŸ”„ Transition:', demande.statut, '->', nouveauStatut);

      // PrÃ©parer donnÃ©es de mise Ã  jour
      const updateData = {};
      if (action === ACTIONS_DEMANDE.VALIDER && montantAutorise) {
        updateData.montantAutorise = parseFloat(montantAutorise);
      }

      // Si validation par RM/DCE/ADG
      if (action === ACTIONS_DEMANDE.VALIDER && ['rm', 'dce', 'adg'].includes(req.user.role)) {
        const validationField = `validePar_${req.user.role}`;
        updateData[validationField] = {
          userId: req.user.id,
          date: new Date(),
          commentaire: commentaire || `ValidÃ© par ${req.user.role.toUpperCase()}`
        };
      }

      // Mettre Ã  jour
      const updated = await this.mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        action,
        req.user.id,
        commentaire || `${action} par ${req.user.role}`,
        updateData
      );

      // Peupler les informations
      const demandePopulee = await DemandeForÃ§ageModel.findById(updated._id)
        .populate('clientId', 'email nom prenom cni')
        .populate('conseillerId', 'email nom prenom');

      // Notification
      try {
        await this.notifierTraitement(demandePopulee, nouveauStatut, req.user);
      } catch (notifError) {
        console.warn('âš ï¸ Erreur notification:', notifError.message);
      }

      console.log('âœ… Traitement effectuÃ©');

      return successResponse(res, 200, `Demande ${action.toLowerCase()} avec succÃ¨s`, {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          statut: demandePopulee.statut,
          montantAutorise: demandePopulee.montantAutorise,
          dateEcheance: demandePopulee.dateEcheance,
          updatedAt: demandePopulee.updatedAt,
          conseiller: demandePopulee.conseillerId
        },
        traitement: {
          action: action,
          traitePar: req.user.email,
          ancienStatut: demande.statut,
          nouveauStatut: nouveauStatut,
          timestamp: new Date()
        },
        workflowInfo: {
          prochainesActions: WorkflowService.getAvailableActions(
            nouveauStatut,
            req.user.role,
            demandePopulee.montant,
            demandePopulee.notationClient || 'C'
          ),
          responsable: WorkflowService.getResponsibleRole(nouveauStatut),
          delaiEstime: WorkflowService.calculatePriority(
            demandePopulee.dateEcheance || new Date(),
            demandePopulee.montant,
            demandePopulee.notationClient || 'C',
            demandePopulee.typeOperation
          )
        }
      });

    } catch (error) {
      console.error('âŒ ERREUR TRAITEMENT:', error);
      return errorResponse(res, 500, 'Erreur lors du traitement de la demande', error.message);
    }
  }

  /**
   * Remonter une demande hiÃ©rarchiquement
   */
  async remonterDemande(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;

      // RÃ©cupÃ©rer demande
      const DemandeForÃ§ageModel = this.getDemandeModel();
      const demande = await DemandeForÃ§ageModel.findById(id)
        .populate('clientId', 'nom prenom email cni');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      // VÃ©rifier permissions
      const actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C'
      );

      if (!actionsDisponibles.includes(ACTIONS_DEMANDE.REMONTER)) {
        return errorResponse(res, 403, 'Vous ne pouvez pas remonter cette demande');
      }

      // DÃ©terminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.REMONTER,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('ðŸ”„ RemontÃ©e:', demande.statut, '->', nouveauStatut);

      // Mettre Ã  jour
      const updated = await this.mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.REMONTER,
        req.user.id,
        commentaire || `RemontÃ©e au niveau supÃ©rieur par ${req.user.role}`,
        {}
      );

      // Notification
      try {
        await this.notifierChangementStatut(updated, nouveauStatut, req.user);
      } catch (notifError) {
        console.warn('âš ï¸ Erreur notification:', notifError.message);
      }

      console.log('âœ… Demande remontÃ©e');

      return successResponse(res, 200, 'Demande remontÃ©e au niveau supÃ©rieur', {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          statut: updated.statut,
          updatedAt: updated.updatedAt
        }
      });

    } catch (error) {
      console.error('âŒ Erreur remontÃ©e:', error);
      return errorResponse(res, 400, error.message || 'Erreur lors de la remontÃ©e');
    }
  }

  /**
   * RÃ©gulariser une demande
   */
  async regulariser(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;

      // RÃ©cupÃ©rer demande
      const DemandeForÃ§ageModel = this.getDemandeModel();
      const demande = await DemandeForÃ§ageModel.findById(id)
        .populate('clientId', 'nom prenom email cni');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      // VÃ©rifier permissions
      const actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C'
      );

      if (!actionsDisponibles.includes(ACTIONS_DEMANDE.REGULARISER)) {
        return errorResponse(res, 403, 'Vous ne pouvez pas rÃ©gulariser cette demande');
      }

      // DÃ©terminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.REGULARISER,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('ðŸ”„ RÃ©gularisation:', demande.statut, '->', nouveauStatut);

      // Mettre Ã  jour
      const updated = await this.mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.REGULARISER,
        req.user.id,
        commentaire || `Demande rÃ©gularisÃ©e par ${req.user.role}`,
        {
          regularisee: true,
          dateRegularisation: new Date()
        }
      );

      // Peupler les informations
      const demandePopulee = await DemandeForÃ§ageModel.findById(updated._id)
        .populate('clientId', 'nom prenom email cni');

      // Notification
      try {
        await this.notifierRegularisation(demandePopulee, req.user);
      } catch (notifError) {
        console.warn('âš ï¸ Erreur notification:', notifError.message);
      }

      console.log('âœ… Demande rÃ©gularisÃ©e');

      return successResponse(res, 200, 'Demande rÃ©gularisÃ©e avec succÃ¨s', {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          regularisee: demandePopulee.regularisee,
          dateRegularisation: demandePopulee.dateRegularisation,
          updatedAt: demandePopulee.updatedAt
        }
      });

    } catch (error) {
      console.error('âŒ Erreur rÃ©gularisation:', error);
      return errorResponse(res, 400, error.message || 'Erreur lors de la rÃ©gularisation');
    }
  }

  /**
   * Obtenir les statistiques
   */
  async getStatistiques(req, res) {
    try {
      const filters = this.construireFiltresStatistiques(req);

      const stats = await DemandeForÃ§ageService.getStatistiques(filters);

      // Enrichir statistiques
      const statsEnrichies = await this.enrichirStatistiques(stats, req.user);

      return successResponse(res, 200, 'Statistiques rÃ©cupÃ©rÃ©es', {
        statistiques: statsEnrichies,
        periode: {
          dateDebut: filters.dateDebut,
          dateFin: filters.dateFin
        }
      });

    } catch (error) {
      console.error('âŒ Erreur statistiques:', error);
      return errorResponse(res, 500, 'Erreur lors de la rÃ©cupÃ©ration des statistiques', error.message);
    }
  }

  /**
   * Mettre Ã  jour une demande
   */
  async mettreAJourDemande(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 400, 'DonnÃ©es invalides', errors.array());
      }

      const DemandeForÃ§ageModel = this.getDemandeModel();

      // VÃ©rifier permissions
      const demande = await DemandeForÃ§ageModel.findById(req.params.id)
        .populate('clientId', '_id');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvÃ©e');
      }

      if (demande.clientId._id.toString() !== req.user.id && req.user.role !== 'admin') {
        return errorResponse(res, 403, 'Seul le propriÃ©taire ou un admin peut modifier');
      }

      if (demande.statut !== STATUTS_DEMANDE.BROUILLON) {
        return errorResponse(res, 400, 'Seules les demandes brouillon peuvent Ãªtre modifiÃ©es');
      }

      // Mettre Ã  jour
      const demandeMaj = await DemandeForÃ§ageModel.findOneAndUpdate(
        { _id: req.params.id },
        { $set: req.body },
        { new: true }
      ).populate('clientId', 'nom prenom email cni');

      // Notification
      try {
        await this.notifierModification(demandeMaj, req.user);
      } catch (notifError) {
        console.warn('âš ï¸ Erreur notification:', notifError.message);
      }

      console.log('âœ… Demande mise Ã  jour');

      return successResponse(res, 200, 'Demande mise Ã  jour avec succÃ¨s', {
        demande: {
          id: demandeMaj._id,
          numeroReference: demandeMaj.numeroReference,
          statut: demandeMaj.statut,
          montant: demandeMaj.montant,
          motif: demandeMaj.motif,
          updatedAt: demandeMaj.updatedAt
        }
      });

    } catch (error) {
      console.error('âŒ Erreur MAJ demande:', error);
      return errorResponse(res, 500, 'Erreur lors de la mise Ã  jour', error.message);
    }
  }

  // ==================== MÃ‰THODES PRIVÃ‰ES ====================

  /**
   * Valider les donnÃ©es de crÃ©ation
   */
  validerDonneesCreation(data) {
    const { motif, montant, typeOperation, dateEcheance } = data;

    if (!motif || typeof motif !== 'string' || motif.trim().length < 10 || motif.trim().length > 500) {
      return { valid: false, message: 'Motif requis (10-500 caractÃ¨res)' };
    }

    if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
      return { valid: false, message: 'Montant invalide. Doit Ãªtre un nombre positif' };
    }

    const montantNum = parseFloat(montant);
    if (montantNum > 100000000) { // 100 millions FCFA maximum
      return { valid: false, message: 'Montant trop Ã©levÃ© (max: 100.000.000 FCFA)' };
    }

    if (!typeOperation) {
      return { valid: false, message: 'Type d\'opÃ©ration requis' };
    }

    const operationsValides = Object.values(TYPES_OPERATION);
    if (!operationsValides.includes(typeOperation.toUpperCase())) {
      return { valid: false, message: `Type d'opÃ©ration invalide` };
    }

    return { valid: true };
  }

  /**
   * Calculer montant de forÃ§age
   */
  calculerMontantForÃ§age(client, montantDemande) {
    const soldeActuel = client.soldeActuel || 0;
    const decouvertAutorise = client.decouvertAutorise || 0;
    return Math.max(0, montantDemande - (soldeActuel + decouvertAutorise));
  }

  /**
   * Traiter les fichiers uploadÃ©s
   */
  #traiterFichiersUpload(files) {
    const piecesJustificatives = [];

    if (files && Array.isArray(files) && files.length > 0) {
      files.forEach(file => {
        piecesJustificatives.push({
          nom: file.originalname,
          url: `/uploads/${file.filename}`,
          type: file.mimetype,
          taille: file.size,
          uploadedAt: new Date()
        });
      });
    }

    return piecesJustificatives;
  }

  /**
   * Construire donnÃ©es demande
   */
  async #construireDonneesDemande(options) {
    const {
      client,
      motif,
      motifDerogation,
      montantDemande,
      typeOperation,
      montantForÃ§ageTotal,
      piecesJustificatives,
      dateEcheance,
      dureeExhaustive,
      tauxInteret,
      garanties,
      observations,
      compteDebit,
      compteNumero,
      devise,
      commentaireInterne,
      user
    } = options;

    // GÃ©nÃ©rer rÃ©fÃ©rence
    const numeroReference = await this.genererReference();

    // Calculer notation et prioritÃ©
    const notationClient = client.notationClient || 'C';
    const priorite = WorkflowService.calculatePriority(
      dateEcheance || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      montantDemande,
      notationClient,
      typeOperation
    );

    const scoreRisque = WorkflowService.calculateRiskLevel(montantDemande, notationClient);

    const demandeData = {
      numeroReference,
      motif: motif.trim(),
      montant: montantDemande,
      typeOperation: typeOperation.toUpperCase(),
      compteNumero: compteNumero || client.numeroCompte,
      clientId: user.id,
      agencyId: client.agencyId, // âœ… CORRIGÃ‰: Utiliser agencyId (ObjectId) au lieu de agence (String)
      conseillerId: null,
      notationClient,
      classification: client.classification || 'normal',
      soldeActuel: client.soldeActuel || 0,
      decouvertAutorise: client.decouvertAutorise || 0,
      montantForÃ§ageTotal,
      statut: STATUTS_DEMANDE.BROUILLON,
      priorite,
      scoreRisque,
      piecesJustificatives,
      devise: devise || 'XAF',
      dureeExhaustive,
      tauxInteret,
      garanties: garanties || [],
      observations,
      motifDerogation,
      clientNom: client.nom,
      clientPrenom: client.prenom,
      clientEmail: client.email,
      clientTelephone: client.telephone,
      clientCni: client.cni, // âœ… AJOUTÃ‰
      clientNumeroCompte: client.numeroCompte, // âœ… AJOUTÃ‰
      historique: [{
        action: 'CREATION',
        statutAvant: null,
        statutApres: STATUTS_DEMANDE.BROUILLON,
        userId: user.id,
        commentaire: 'Demande crÃ©Ã©e via formulaire simple',
        timestamp: new Date()
      }]
    };

    // Gestion de la date d'Ã©chÃ©ance amÃ©liorÃ©e
    if (dateEcheance) {
      // VÃ©rifier si c'est un nombre (mois) ou une date ISO
      if (!isNaN(dateEcheance) && parseInt(dateEcheance) > 0) {
        // C'est un nombre de mois
        const nombreMois = parseInt(dateEcheance);
        const today = new Date();
        const echeance = new Date(today.getFullYear(), today.getMonth() + nombreMois, today.getDate());
        demandeData.dateEcheance = echeance;
      } else {
        // Essayer de parser comme date ISO
        try {
          const parsedDate = new Date(dateEcheance);
          if (!isNaN(parsedDate.getTime())) {
            demandeData.dateEcheance = parsedDate;
          } else {
            // Date par dÃ©faut: J+15
            demandeData.dateEcheance = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
          }
        } catch {
          demandeData.dateEcheance = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
        }
      }
    } else {
      demandeData.dateEcheance = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    }

    if (compteDebit) demandeData.compteDebit = compteDebit;
    if (commentaireInterne) demandeData.commentaireInterne = commentaireInterne;

    return demandeData;
  }

  /**
   * GÃ©nÃ©rer numÃ©ro de rÃ©fÃ©rence
   */
  async #genererReference() {
    try {
      const DemandeForÃ§ageModel = this.getDemandeModel();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const prefix = `DF${year}${month}${day}`;

      // Chercher la derniÃ¨re rÃ©fÃ©rence du jour
      const lastDemande = await DemandeForÃ§ageModel.findOne({
        numeroReference: new RegExp(`^${prefix}`)
      }).sort({ numeroReference: -1 });

      let sequence = 1;
      if (lastDemande && lastDemande.numeroReference) {
        const lastSeq = parseInt(lastDemande.numeroReference.slice(-4)) || 0;
        sequence = lastSeq + 1;

        // Si on dÃ©passe 9999, on ajoute un suffixe
        if (sequence > 9999) {
          const suffix = String.fromCharCode(65 + Math.floor((sequence - 10000) / 1000));
          sequence = (sequence - 10000) % 1000;
          return `${prefix}${suffix}${String(sequence).padStart(3, '0')}`;
        }
      }

      return `${prefix}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
      console.warn('âš ï¸ Erreur gÃ©nÃ©ration rÃ©fÃ©rence, utilisation fallback');
      // Fallback avec timestamp plus UUID court
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      return `DF${timestamp}${random}`.toUpperCase();
    }
  }

  /**
   * Assigner conseiller automatiquement
   */
  async #assignerConseillerAutomatique(demandeId, agencyId) {
    try {
      const DemandeForÃ§ageModel = this.getDemandeModel();
      
      // Chercher un conseiller par agencyId (ObjectId)
      const conseiller = await User.findOne({
        role: 'conseiller',
        agencyId: agencyId, // âœ… CORRIGÃ‰: Utiliser agencyId au lieu de agence
        isActive: true
      }).select('_id email nom prenom');

      if (conseiller) {
        await DemandeForÃ§ageModel.findByIdAndUpdate(demandeId, {
          $set: { conseillerId: conseiller._id }
        });

        try {
          await this.notifierAssignationConseiller(demandeId, conseiller);
        } catch (notifError) {
          console.warn('âš ï¸ Erreur notification assignation:', notifError.message);
        }

        return conseiller;
      }

      console.warn('âš ï¸ Aucun conseiller disponible pour l\'agencyId:', agencyId);
      return null;
    } catch (error) {
      console.error('âŒ Erreur assignation conseiller:', error);
      return null;
    }
  }

  /**
   * Mettre Ã  jour statut demande
   */
  async #mettreAJourStatutDemande(demandeId, statutAvant, statutApres, action, userId, commentaire, updateData = {}) {
    const DemandeForÃ§ageModel = this.getDemandeModel();
    const update = {
      $set: {
        statut: statutApres,
        updatedAt: new Date(),
        ...updateData
      },
      $push: {
        historique: {
          action: action,
          statutAvant: statutAvant,
          statutApres: statutApres,
          userId: userId,
          commentaire: commentaire,
          timestamp: new Date()
        }
      }
    };

    return await DemandeForÃ§ageModel.findByIdAndUpdate(
      demandeId,
      update,
      { new: true }
    );
  }

  /**
   * Construire filtres selon rÃ´le
   */
  #construireFiltres(req) {
    const { role, id: userId, agence, agencyId } = req.user;
    const { statut, priorite, dateDebut, dateFin } = req.query;

    const filters = {};

    console.log('ðŸ” [FILTERS] Building filters for role:', role);
    console.log('ðŸ” [FILTERS] User agence:', agence);
    console.log('ðŸ” [FILTERS] User agencyId:', agencyId);

    switch (role) {
      case 'client':
        filters.clientId = userId;
        console.log('ðŸ” [FILTERS] Client filter - clientId:', userId);
        break;

      case 'conseiller':
        // âœ… CORRECTION: Filtrer par agencyId (ObjectId) ET/OU conseiller assignÃ©
        filters.$or = [
          { conseillerId: userId }, // Demandes assignÃ©es Ã  ce conseiller
          {
            agencyId: agencyId, // Utiliser agencyId au lieu de agence
            conseillerId: null // Demandes non assignÃ©es dans cette agence
          }
        ];
        console.log('ðŸ” [FILTERS] Conseiller filter:', filters.$or);
        break;

      case 'rm':
      case 'dce':
        // âœ… CORRECTION: Utiliser agencyId (ObjectId) pour filtrer
        filters.agencyId = agencyId;
        console.log('ðŸ” [FILTERS] RM/DCE filter - agencyId:', agencyId);
        break;

      case 'admin':
      case 'dga':
      case 'risques':
      case 'adg':
        // Pas de filtre par dÃ©faut - voient tout
        console.log('ðŸ” [FILTERS] Admin/DGA/Risques/ADG - no filter');
        break;

      default:
        filters.clientId = userId;
    }

    // Filtres additionnels
    if (statut) filters.statut = statut;
    if (priorite) filters.priorite = priorite;

    if (dateDebut || dateFin) {
      filters.createdAt = {};
      if (dateDebut) filters.createdAt.$gte = new Date(dateDebut);
      if (dateFin) filters.createdAt.$lte = new Date(dateFin);
    }

    return filters;
  }

  /**
   * Construire options pagination/tri
   */
  #construireOptions(req) {
    return {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sort: req.query.sort || '-createdAt'
    };
  }

  /**
   * Adapter rÃ©ponse demandes selon rÃ´le
   */
  async #adapterReponseDemandes(demandes, user) {
    const role = user.role;

    return demandes.map((demande, index) => {
      // Logging pour dÃ©boguer
      console.log(`ðŸ” Demande ${index}:`, {
        id: demande._id,
        ref: demande.numeroReference,
        clientId: demande.clientId,
        clientNom: demande.clientNom,
        clientPrenom: demande.clientPrenom,
        hasClientObject: !!demande.clientId && typeof demande.clientId === 'object'
      });

      // Extraire les informations client - PRIORITÃ‰: objet populÃ© > champs directs
      let clientNomComplet = 'N/A';
      let clientEmail = 'N/A';
      let clientCni = 'N/A';
      let clientId = null;

      if (demande.clientId && typeof demande.clientId === 'object') {
        // Client est un objet populÃ© (prioritÃ© 1)
        clientNomComplet = `${demande.clientId.prenom || ''} ${demande.clientId.nom || ''}`.trim() || 'N/A';
        clientEmail = demande.clientId.email || 'N/A';
        clientCni = demande.clientId.cni || 'N/A';
        clientId = demande.clientId._id;
      } else if (demande.clientNom || demande.clientPrenom) {
        // Utiliser les champs stockÃ©s directement (prioritÃ© 2)
        const prenom = demande.clientPrenom || '';
        const nom = demande.clientNom || '';
        clientNomComplet = `${prenom} ${nom}`.trim() || 'N/A';
        clientEmail = demande.clientEmail || 'N/A';
        clientCni = demande.clientCni || 'N/A';
        clientId = demande.clientId; // Peut Ãªtre un ID string
      }

      const base = {
        id: demande._id,
        numeroReference: demande.numeroReference,
        statut: demande.statut,
        montant: demande.montant,
        typeOperation: demande.typeOperation,
        scoreRisque: demande.scoreRisque,
        priorite: demande.priorite || 'NORMALE',
        createdAt: demande.createdAt,
        enRetard: demande.enRetard || false,
        dateEcheance: demande.dateEcheance,
        joursRestants: demande.dateEcheance ?
          Math.ceil((new Date(demande.dateEcheance) - new Date()) / (1000 * 60 * 60 * 24)) : null,
        clientObject: clientNomComplet, // âœ… Utiliser 'clientObject' pour compatibilitÃ© frontend
        client: clientNomComplet, // Garder aussi pour compatibilitÃ©
        clientNomComplet: clientNomComplet // Garder aussi pour compatibilitÃ©
      };

      // Infos supplÃ©mentaires selon rÃ´le
      if (role !== 'client') {
        base.clientDetails = {
          id: clientId,
          nom: demande.clientId?.nom || demande.clientNom || 'N/A',
          prenom: demande.clientId?.prenom || demande.clientPrenom || 'N/A',
          email: clientEmail,
          cni: clientCni,
          agence: demande.agenceId
        };

        if (['conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'].includes(role)) {
          base.conseiller = demande.conseillerId;
          base.notationClient = demande.notationClient || 'C';
          base.agenceId = demande.agenceId;
          base.montantAutorise = demande.montantAutorise;
        }
      }

      return base;
    });
  }

  /**
   * Obtenir actions disponibles
   */
  #getActionsDisponibles(demande, user) {
    const isOwner = demande.client && demande.client.id === user.id;
    return WorkflowService.getAvailableActions(
      demande.statut,
      user.role,
      demande.montant,
      demande.notationClient || 'C',
      isOwner
    );
  }

  /**
   * VÃ©rifier permission sur demande
   */
  #verifierPermissionDemande(demande, user) {
    // Admins et rÃ´les supÃ©rieurs voient tout
    if (['admin', 'dga', 'risques', 'adg'].includes(user.role)) return true;

    // Client voit ses demandes
    if (user.role === 'client') {
      const clientId = demande.clientId._id ? demande.clientId._id.toString() : demande.clientId.toString();
      return clientId === user.id;
    }

    // Conseiller voit les demandes de son agence (assignÃ©es ou non)
    if (user.role === 'conseiller') {
      // Peut voir les demandes assignÃ©es Ã  lui
      if (demande.conseillerId) {
        const conseillerId = demande.conseillerId._id ? demande.conseillerId._id.toString() : demande.conseillerId.toString();
        if (conseillerId === user.id) return true;
      }

      // Peut aussi voir les demandes de son agence (mÃªme si non assignÃ©es)
      const demandeAgencyId = demande.agencyId ? demande.agencyId.toString() : null;
      const userAgencyId = user.agencyId ? user.agencyId.toString() : null;
      return demandeAgencyId && userAgencyId && demandeAgencyId === userAgencyId;
    }

    // RM/DCE voient les demandes de leur agence
    if (['rm', 'dce'].includes(user.role)) {
      const demandeAgencyId = demande.agencyId ? demande.agencyId.toString() : null;
      const userAgencyId = user.agencyId ? user.agencyId.toString() : null;
      return demandeAgencyId && userAgencyId && demandeAgencyId === userAgencyId;
    }

    return false;
  }

  /**
   * Formater rÃ©ponse dÃ©taillÃ©e
   */
  // src/controllers/demandeForÃ§age.controller.js - VERSION CORRIGÃ‰E COMPLÃˆTE

  // Dans la mÃ©thode #formaterReponseDemande, remplacer par :

  async #formaterReponseDemande(demande, user) {
    const base = {
      id: demande._id,
      numeroReference: demande.numeroReference,
      statut: demande.statut,
      montant: demande.montant,
      typeOperation: demande.typeOperation,
      motif: demande.motif,
      scoreRisque: demande.scoreRisque,
      priorite: demande.priorite || 'NORMALE',
      createdAt: demande.createdAt,
      updatedAt: demande.updatedAt,
      enRetard: demande.enRetard || false,
      dateEcheance: demande.dateEcheance,
      joursRestants: demande.dateEcheance ?
        Math.ceil((new Date(demande.dateEcheance) - new Date()) / (1000 * 60 * 60 * 24)) : null,

      // âœ… AJOUT DES CHAMPS MANQUANTS
      dureeExhaustive: demande.dureeExhaustive,
      tauxInteret: demande.tauxInteret,
      garanties: demande.garanties || [],
      observations: demande.observations,
      motifDerogation: demande.motifDerogation,
      compteNumero: demande.compteNumero,
      compteDebit: demande.compteDebit,
      devise: demande.devise || 'XAF',

      clientNomComplet: demande.clientNomComplet ||
        (demande.clientId ? `${demande.clientId.prenom} ${demande.clientId.nom}` :
          (demande.clientPrenom && demande.clientNom ? `${demande.clientPrenom} ${demande.clientNom}` : 'Client'))
    };

    // Infos client complÃ¨tes
    base.client = {
      id: demande.clientId._id ? demande.clientId._id : demande.clientId,
      nom: demande.clientId.nom || demande.clientNom || 'N/A',
      prenom: demande.clientId.prenom || demande.clientPrenom || 'N/A',
      email: demande.clientId.email || demande.clientEmail || 'N/A',
      telephone: demande.clientId.telephone || demande.clientTelephone || 'N/A',
      cni: demande.clientId?.cni || demande.clientCni || 'N/A', // âœ… VÃ©rifier aussi demande.clientCni
      numeroCompte: demande.clientId?.numeroCompte || demande.clientNumeroCompte || demande.compteNumero || 'N/A', // âœ… VÃ©rifier aussi demande.clientNumeroCompte
      agence: demande.clientId?.agence || demande.clientAgence || demande.agenceId || 'N/A', // âœ… VÃ©rifier aussi demande.clientAgence
      nomComplet: demande.clientNomComplet ||
        `${demande.clientId?.prenom || demande.clientPrenom || ''} ${demande.clientId?.nom || demande.clientNom || ''}`.trim()
    };

    // Infos supplÃ©mentaires selon rÃ´le
    if (user.role !== 'client') {
      base.client.notationClient = demande.notationClient || 'C';
      base.client.classification = demande.classification;

      base.agenceId = demande.agenceId;
      base.conseiller = demande.conseillerId;
      base.montantAutorise = demande.montantAutorise;
      base.commentaireTraitement = demande.commentaireTraitement;
      base.piecesJustificatives = demande.piecesJustificatives;
      base.commentaireInterne = demande.commentaireInterne; // âœ… AJOUTÃ‰

      if (['admin', 'dga', 'adg', 'risques'].includes(user.role)) {
        base.soldeActuel = demande.soldeActuel;
        base.decouvertAutorise = demande.decouvertAutorise;
        base.montantForÃ§ageTotal = demande.montantForÃ§ageTotal;
        base.historique = demande.historique;
        base.validePar_conseiller = demande.validePar_conseiller;
        base.validePar_rm = demande.validePar_rm;
        base.validePar_dce = demande.validePar_dce;
        base.validePar_adg = demande.validePar_adg;
      }
    }

    return base;
  }

  /**
   * VÃ©rifier si peut soumettre
   */
  #peutSoumettreDemande(demande, user) {
    const clientId = demande.clientId._id ? demande.clientId._id.toString() : demande.clientId.toString();
    return clientId === user.id.toString() &&
      demande.statut === STATUTS_DEMANDE.BROUILLON;
  }

  /**
   * VÃ©rifier si peut annuler
   */
  #peutAnnulerDemande(demande, user) {
    const clientId = demande.clientId._id ? demande.clientId._id.toString() : demande.clientId.toString();
    return clientId === user.id.toString() || ['admin', 'dga'].includes(user.role);
  }

  /**
   * Construire filtres statistiques
   */
  #construireFiltresStatistiques(req) {
    const filters = {};

    if (req.user.role === 'client') {
      filters.clientId = req.user.id;
    }

    if (req.query.dateDebut) filters.dateDebut = req.query.dateDebut;
    if (req.query.dateFin) filters.dateFin = req.query.dateFin;

    if (req.query.agenceId && ['admin', 'dga', 'adg', 'risques'].includes(req.user.role)) {
      filters.agenceId = req.query.agenceId;
    }

    return filters;
  }

  /**
   * Enrichir statistiques
   */
  async #enrichirStatistiques(stats, user) {
    const enrichies = { ...stats };

    if (['admin', 'dga', 'adg', 'risques'].includes(user.role)) {
      // Stats par agence
      const DemandeForÃ§ageModel = this.getDemandeModel();
      const statsAgence = await DemandeForÃ§ageModel.aggregate([
        {
          $group: {
            _id: '$agenceId',
            total: { $sum: 1 },
            montantTotal: { $sum: '$montant' },
            montantForÃ§ageTotal: { $sum: '$montantForÃ§ageTotal' },
            validees: {
              $sum: { $cond: [{ $in: ["$statut", ["APPROUVEE", "DECAISSEE"]] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      enrichies.parAgence = statsAgence;

      // Taux
      if (stats.total > 0) {
        enrichies.tauxValidation = (stats.validees / stats.total) * 100;
        enrichies.tauxRefus = (stats.refusees / stats.total) * 100;
        enrichies.tauxAttente = (stats.enAttente / stats.total) * 100;
      }
    }

    return enrichies;
  }

  /**
   * Obtenir le modÃ¨le DemandeForÃ§age
   */
  #getDemandeModel() {
    return require('../models/DemandeForÃ§age');
  }

  // ==================== NOTIFICATIONS ====================

  async #notifierCreation(demande, user) {
    try {
      // Utiliser l'ID du user connectÃ© (qui est le client)
      const clientId = user.id || user._id;

      console.log('ðŸ“§ Envoi notification crÃ©ation:', {
        clientId: clientId.toString(),
        userId: user.id,
        demandeRef: demande.numeroReference,
        demandeId: demande._id.toString(),
        userRole: user.role
      });

      const result = await NotificationService.createNotification({
        utilisateur: clientId,
        titre: 'âœ… Demande crÃ©Ã©e',
        message: `Votre demande ${demande.numeroReference} a Ã©tÃ© crÃ©Ã©e avec succÃ¨s`,
        entite: 'demande',
        entiteId: demande._id,
        type: 'success',
        categorie: 'demande_creation',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id.toString(),
          montant: demande.montant,
          typeOperation: demande.typeOperation,
          createdBy: user.id
        },
        tags: ['demande', 'creation']
      });

      console.log('âœ… Notification crÃ©ation envoyÃ©e:', result._id);
    } catch (error) {
      console.error('âŒ Erreur notification crÃ©ation:', error.message);
    }
  }

  async #notifierSoumission(demande, user) {
    try {
      // Utiliser l'ID du user connectÃ© (qui est le client)
      const clientId = user.id || user._id;

      console.log('ðŸ“§ Envoi notification soumission:', {
        clientId: clientId.toString(),
        userId: user.id,
        demandeRef: demande.numeroReference,
        demandeId: demande._id.toString(),
        userRole: user.role
      });

      const result = await NotificationService.createNotification({
        utilisateur: clientId,
        titre: 'ðŸ“¤ Demande soumise',
        message: `Votre demande ${demande.numeroReference} a Ã©tÃ© soumise pour traitement`,
        entite: 'demande',
        entiteId: demande._id,
        type: 'info',
        categorie: 'demande',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id.toString(),
          statut: demande.statut,
          submittedBy: user.id
        },
        tags: ['demande', 'soumission']
      });

      console.log('âœ… Notification soumission envoyÃ©e:', result._id);
    } catch (error) {
      console.error('âŒ Erreur notification soumission:', error.message);
    }
  }

  async #notifierAnnulation(demande, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;

      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: 'âŒ Demande annulÃ©e',
        message: `Votre demande ${demande.numeroReference} a Ã©tÃ© annulÃ©e`,
        entite: 'demande',
        entiteId: demande._id,
        type: 'warning',
        categorie: 'demande_annulation',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id,
          statut: demande.statut
        },
        tags: ['demande', 'annulation']
      });
    } catch (error) {
      console.warn('âš ï¸ Erreur notification annulation:', error.message);
    }
  }

  async #notifierModification(demande, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;

      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: 'âœï¸ Demande modifiÃ©e',
        message: `Votre demande ${demande.numeroReference} a Ã©tÃ© mise Ã  jour`,
        entite: 'demande',
        entiteId: demande._id,
        type: 'info',
        categorie: 'demande_modification',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id,
          statut: demande.statut
        },
        tags: ['demande', 'modification']
      });
    } catch (error) {
      console.warn('âš ï¸ Erreur notification modification:', error.message);
    }
  }

  async #notifierTraitement(demande, nouveauStatut, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;

      const statutMessages = {
        'APPROUVEE': 'a Ã©tÃ© approuvÃ©e âœ…',
        'REJETEE': 'a Ã©tÃ© rejetÃ©e âŒ',
        'EN_COURS': 'est en cours de traitement ðŸ”„',
        'DECAISSEE': 'a Ã©tÃ© dÃ©caissÃ©e ðŸ’°',
        'REGULARISEE': 'a Ã©tÃ© rÃ©gularisÃ©e âœ…'
      };

      const message = statutMessages[nouveauStatut] || `a changÃ© de statut: ${nouveauStatut}`;

      console.log('ðŸ“§ Envoi notification traitement:', {
        clientId: clientId.toString(),
        demandeRef: demande.numeroReference,
        demandeId: demande._id,
        nouveauStatut: nouveauStatut
      });

      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: `ðŸ“‹ Demande ${demande.numeroReference} - ${nouveauStatut}`,
        message: `Votre demande ${message}`,
        entite: 'demande',
        entiteId: demande._id,
        type: nouveauStatut === 'REJETEE' ? 'error' :
          nouveauStatut === 'APPROUVEE' ? 'success' : 'info',
        categorie: 'demande_traitement',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id,
          ancienStatut: demande.statut,
          nouveauStatut: nouveauStatut,
          traitePar: user.email
        },
        declencheur: user.id,
        tags: ['demande', 'traitement', nouveauStatut]
      });

      console.log('âœ… Notification traitement envoyÃ©e');
    } catch (error) {
      console.warn('âš ï¸ Erreur notification traitement:', error.message);
    }
  }

  async #notifierRegularisation(demande, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;

      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: 'âœ… Demande rÃ©gularisÃ©e',
        message: `Votre demande ${demande.numeroReference} a Ã©tÃ© rÃ©gularisÃ©e`,
        entite: 'demande',
        entiteId: demande._id,
        type: 'success',
        categorie: 'demande_regularisation',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id,
          statut: demande.statut,
          dateRegularisation: demande.dateRegularisation
        },
        tags: ['demande', 'regularisation']
      });
    } catch (error) {
      console.warn('âš ï¸ Erreur notification rÃ©gularisation:', error.message);
    }
  }

  async #notifierAssignationConseiller(demandeId, conseiller) {
    try {
      await NotificationService.createNotification({
        utilisateur: conseiller._id,
        titre: 'ðŸ“‹ Nouvelle demande assignÃ©e',
        message: `Une demande vous a Ã©tÃ© assignÃ©e`,
        entite: 'demande',
        entiteId: demandeId,
        type: 'info',
        categorie: 'demande_assignation',
        priorite: 'normale',
        lien: `/demandes/${demandeId}`,
        metadata: {
          demandeId: demandeId,
          assignePar: 'system'
        },
        tags: ['demande', 'assignation']
      });
    } catch (error) {
      console.warn('âš ï¸ Erreur notification assignation:', error.message);
    }
  }

  async #notifierChangementStatut(demande, nouveauStatut, user) {
    try {
      // DÃ©lÃ©guer Ã  #notifierTraitement pour Ã©viter la duplication
      await this.notifierTraitement(demande, nouveauStatut, user);
    } catch (error) {
      console.warn('âš ï¸ Erreur notification changement statut:', error.message);
    }
  }
}

// CrÃ©er une instance et binder les mÃ©thodes
const controller = new DemandeForÃ§ageController();

// Exporter les mÃ©thodes bindÃ©es
module.exports = {
  creerDemande: controller.creerDemande.bind(controller),
  listerDemandes: controller.listerDemandes.bind(controller),
  getDemande: controller.getDemande.bind(controller),
  soumettreDemande: controller.soumettreDemande.bind(controller),
  annulerDemande: controller.annulerDemande.bind(controller),
  mettreAJourDemande: controller.mettreAJourDemande.bind(controller),
  traiterDemande: controller.traiterDemande.bind(controller),
  remonterDemande: controller.remonterDemande.bind(controller),
  regulariser: controller.regulariser.bind(controller),
  getStatistiques: controller.getStatistiques.bind(controller)
};
