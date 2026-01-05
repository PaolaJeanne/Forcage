// src/controllers/demandeForçage.controller.js - VERSION CORRIGÉE COMPLÈTE
const DemandeForçageService = require('../services/demandeForcage.service');
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

class DemandeForçageController {
  
  // ==================== MÉTHODES PUBLIQUES ====================

  /**
   * Créer une nouvelle demande
   */
  async creerDemande(req, res) {
    try {
      console.log('📥 Création demande - Body:', JSON.stringify(req.body, null, 2));
      console.log('👤 User:', req.user);

      // Vérification rôle client
      if (req.user.role !== 'client') {
        return errorResponse(res, 403, 'Seuls les clients peuvent créer des demandes');
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
      const validation = this.#validerDonneesCreation({
        motif: motif || motifDerogation,
        montant,
        typeOperation,
        dateEcheance
      });

      if (!validation.valid) {
        console.error('❌ Validation échouée:', validation.message);
        return errorResponse(res, 400, validation.message);
      }

      // Récupérer client
      const client = await User.findById(req.user.id);
      if (!client) {
        return errorResponse(res, 404, 'Client introuvable');
      }

      console.log('✅ Client trouvé:', {
        email: client.email,
        nom: `${client.prenom} ${client.nom}`
      });

      // Calculer montants
      const montantDemande = parseFloat(montant);
      const montantForçageTotal = this.#calculerMontantForçage(client, montantDemande);

      // Traiter fichiers
      const piecesJustificatives = this.#traiterFichiersUpload(req.files);

      // Construire données demande
      const demandeData = await this.#construireDonneesDemande({
        client,
        motif: motif || motifDerogation,
        montantDemande,
        typeOperation,
        montantForçageTotal,
        piecesJustificatives,
        dateEcheance: dureeExhaustive, // ✅ CORRIGÉ: Utiliser dureeExhaustive pour dateEcheance
        dureeExhaustive,
        tauxInteret,
        garanties: garanties || [], // ✅ CORRIGÉ: S'assurer que c'est un tableau
        observations,
        motifDerogation,
        compteDebit,
        compteNumero: compteNumero || client.numeroCompte,
        devise,
        commentaireInterne,
        user: req.user
      });

      console.log('📦 Données demande construites:', {
        ref: demandeData.numeroReference,
        montant: demandeData.montant,
        type: demandeData.typeOperation,
        priorite: demandeData.priorite
      });

      // Créer demande
      const DemandeForçageModel = this.#getDemandeModel(); // ✅ CORRIGÉ: Renommer pour éviter confusion
      const nouvelleDemande = await DemandeForçageModel.create(demandeData);
      
      // Peupler les informations client
      const demandePopulee = await DemandeForçageModel.findById(nouvelleDemande._id)
        .populate('clientId', 'nom prenom email telephone cni')
        .populate('conseillerId', 'nom prenom email');

      console.log('✅ Demande créée avec ID:', demandePopulee._id);

      // Assigner conseiller
      try {
        await this.#assignerConseillerAutomatique(demandePopulee._id, demandePopulee.agenceId);
        console.log('✅ Conseiller assigné');
      } catch (assignError) {
        console.warn('⚠️ Erreur assignation conseiller (non bloquante):', assignError.message);
      }

      // Notification (avec gestion d'erreur SSL)
      try {
        await this.#notifierCreation(demandePopulee, req.user);
        console.log('✅ Notification envoyée');
      } catch (notifError) {
        // Ne pas bloquer la création si l'email échoue
        console.warn('⚠️ Erreur notification (non bloquante):', notifError.message);
        if (notifError.message && notifError.message.includes('SSL')) {
          console.warn('⚠️ Erreur SSL détectée - Service email probablement mal configuré');
        }
      }

      console.log('✅ Demande créée avec succès');

      // Réponse
      return successResponse(res, 201, 'Demande créée avec succès', {
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
      console.error('❌ ERREUR CRÉATION DEMANDE:', error);
      console.error('Stack:', error.stack);
      
      // Message d'erreur plus détaillé
      let errorMessage = 'Erreur lors de la création de la demande';
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
   * Lister les demandes selon le rôle
   */
  async listerDemandes(req, res) {
    try {
      const logger = require('../utils/logger.util').child('DEMANDE_LIST');
      logger.header('LIST DEMANDES', '📋');
      logger.request('GET', '/demandes', req.user);
      
      const filters = this.#construireFiltres(req);
      const options = this.#construireOptions(req);

      logger.debug('Filters applied:', filters);
      logger.debug('Options:', options);
      
      const result = await DemandeForçageService.listerDemandes(filters, options);
      logger.success(`Found ${result.demandes.length} demandes`, { total: result.pagination.total });

      // Adapter la réponse
      const demandesAdaptees = await this.#adapterReponseDemandes(result.demandes, req.user);

      // Ajouter actions disponibles
      const demandesAvecActions = demandesAdaptees.map(demande => ({
        ...demande,
        actionsDisponibles: this.#getActionsDisponibles(demande, req.user)
      }));

      logger.response(200, 'Demandes listées');
      logger.footer();

      return successResponse(res, 200, 'Liste des demandes récupérée', {
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
   * Consulter une demande spécifique
   */
  async getDemande(req, res) {
    try {
      const logger = require('../utils/logger.util').child('DEMANDE_GET');
      logger.header('GET DEMANDE', '🔍');
      logger.request('GET', `/demandes/${req.params.id}`, req.user);
      
      const demandeId = req.params.id;
      logger.debug('Demande ID:', { id: demandeId });
      
      const demande = await DemandeForçageService.getDemandeById(demandeId);

      if (!demande) {
        logger.warn('Demande not found', { id: demandeId });
        logger.footer();
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      logger.success('Demande found', { ref: demande.numeroReference });

      // Vérifier permissions
      if (!this.#verifierPermissionDemande(demande, req.user)) {
        logger.permission(false, `view_demande_${demandeId}`, req.user);
        logger.footer();
        return errorResponse(res, 403, 'Accès non autorisé à cette demande');
      }

      logger.permission(true, `view_demande_${demandeId}`, req.user);

      // Formater réponse
      const reponseFormatee = await this.#formaterReponseDemande(demande, req.user);

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

      return successResponse(res, 200, 'Détails de la demande', {
        demande: reponseFormatee
      });

    } catch (error) {
      const logger = require('../utils/logger.util').child('DEMANDE_GET');
      logger.error('Error fetching demande', error);
      logger.footer();
      return errorResponse(res, 404, error.message || 'Demande non trouvée');
    }
  }

  /**
   * Soumettre une demande brouillon
   */
  async soumettreDemande(req, res) {
    try {
      console.log('📤 Soumission demande:', req.params.id);

      const { id } = req.params;
      const { commentaire } = req.body || {};

      // Récupérer demande AVEC POPULATE
      const DemandeForçageModel = this.#getDemandeModel();
      const demande = await DemandeForçageModel.findById(id)
        .populate('clientId', 'nom prenom email cni')
        .populate('conseillerId', 'nom prenom email');
      
      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      console.log('✅ Demande trouvée:', demande.numeroReference);

      // Vérifier permissions
      if (!this.#peutSoumettreDemande(demande, req.user)) {
        console.error('❌ Permission refusée');
        return errorResponse(res, 403, 'Vous n\'êtes pas autorisé à soumettre cette demande');
      }

      // Déterminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.SOUMETTRE,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('🔄 Transition:', demande.statut, '->', nouveauStatut);

      // Mettre à jour demande
      const updated = await this.#mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.SOUMETTRE,
        req.user.id,
        commentaire || 'Demande soumise pour traitement',
        { dateSoumission: new Date() }
      );

      // Peupler les informations
      const demandePopulee = await DemandeForçageModel.findById(updated._id)
        .populate('clientId', 'nom prenom email cni')
        .populate('conseillerId', 'nom prenom email');

      // Assigner conseiller si nécessaire
      if (!demandePopulee.conseillerId) {
        try {
          await this.#assignerConseillerAutomatique(demandePopulee._id, demandePopulee.agenceId);
        } catch (assignError) {
          console.warn('⚠️ Erreur assignation conseiller:', assignError.message);
        }
      }

      // Notification (avec gestion d'erreur)
      try {
        await this.#notifierSoumission(demandePopulee, req.user);
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }

      console.log('✅ Demande soumise avec succès');

      return successResponse(res, 200, 'Demande soumise avec succès', {
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
      console.error('❌ ERREUR SOUMISSION:', error);
      return errorResponse(res, 500, 'Erreur lors de la soumission de la demande', error.message);
    }
  }

  /**
   * Annuler une demande
   */
  async annulerDemande(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body || {};

      const DemandeForçageModel = this.#getDemandeModel();
      const demande = await DemandeForçageModel.findById(id)
        .populate('clientId', 'nom prenom email cni');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      // Vérifier permissions
      if (!this.#peutAnnulerDemande(demande, req.user)) {
        return errorResponse(res, 403, 'Seul le client peut annuler sa demande');
      }

      // Déterminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.ANNULER,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('🔄 Annulation:', demande.statut, '->', nouveauStatut);

      // Mettre à jour
      const updated = await this.#mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.ANNULER,
        req.user.id,
        commentaire || 'Demande annulée par le client',
        { dateAnnulation: new Date() }
      );

      // Peupler les informations
      const demandePopulee = await DemandeForçageModel.findById(updated._id)
        .populate('clientId', 'nom prenom email cni');

      // Notification
      try {
        await this.#notifierAnnulation(demandePopulee, req.user);
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }

      console.log('✅ Demande annulée');

      return successResponse(res, 200, 'Demande annulée avec succès', {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          statut: demandePopulee.statut,
          updatedAt: demandePopulee.updatedAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      return errorResponse(res, 400, error.message || 'Erreur lors de l\'annulation');
    }
  }

  /**
   * Traiter une demande (validation, rejet, etc.)
   */
  async traiterDemande(req, res) {
    try {
      console.log('⚙️ Traitement demande:', req.params.id);

      const { id } = req.params;
      const { action, commentaire, montantAutorise } = req.body;

      if (!action) {
        return errorResponse(res, 400, 'L\'action est requise (VALIDER, REJETER, etc.)');
      }

      // Récupérer demande
      const DemandeForçageModel = this.#getDemandeModel();
      const demande = await DemandeForçageModel.findById(id)
        .populate('clientId', 'email nom prenom cni')
        .populate('conseillerId', 'email nom prenom');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      console.log('✅ Demande trouvée:', demande.numeroReference);

      // Vérifier actions disponibles
      const isOwner = demande.clientId && demande.clientId._id.toString() === req.user.id.toString();
      const actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C',
        isOwner
      );

      if (!actionsDisponibles.includes(action)) {
        return errorResponse(res, 403, `Action "${action}" non autorisée`, {
          details: {
            statutActuel: demande.statut,
            roleUtilisateur: req.user.role,
            actionsAutorisees: actionsDisponibles
          }
        });
      }

      // Déterminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        action,
        demande.statut,
        montantAutorise || demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('🔄 Transition:', demande.statut, '->', nouveauStatut);

      // Préparer données de mise à jour
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
          commentaire: commentaire || `Validé par ${req.user.role.toUpperCase()}`
        };
      }

      // Mettre à jour
      const updated = await this.#mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        action,
        req.user.id,
        commentaire || `${action} par ${req.user.role}`,
        updateData
      );

      // Peupler les informations
      const demandePopulee = await DemandeForçageModel.findById(updated._id)
        .populate('clientId', 'email nom prenom cni')
        .populate('conseillerId', 'email nom prenom');

      // Notification
      try {
        await this.#notifierTraitement(demandePopulee, nouveauStatut, req.user);
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }

      console.log('✅ Traitement effectué');

      return successResponse(res, 200, `Demande ${action.toLowerCase()} avec succès`, {
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
      console.error('❌ ERREUR TRAITEMENT:', error);
      return errorResponse(res, 500, 'Erreur lors du traitement de la demande', error.message);
    }
  }

  /**
   * Remonter une demande hiérarchiquement
   */
  async remonterDemande(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;

      // Récupérer demande
      const DemandeForçageModel = this.#getDemandeModel();
      const demande = await DemandeForçageModel.findById(id)
        .populate('clientId', 'nom prenom email cni');
      
      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      // Vérifier permissions
      const actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C'
      );

      if (!actionsDisponibles.includes(ACTIONS_DEMANDE.REMONTER)) {
        return errorResponse(res, 403, 'Vous ne pouvez pas remonter cette demande');
      }

      // Déterminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.REMONTER,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('🔄 Remontée:', demande.statut, '->', nouveauStatut);

      // Mettre à jour
      const updated = await this.#mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.REMONTER,
        req.user.id,
        commentaire || `Remontée au niveau supérieur par ${req.user.role}`,
        {}
      );

      // Notification
      try {
        await this.#notifierChangementStatut(updated, nouveauStatut, req.user);
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }

      console.log('✅ Demande remontée');

      return successResponse(res, 200, 'Demande remontée au niveau supérieur', {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          statut: updated.statut,
          updatedAt: updated.updatedAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur remontée:', error);
      return errorResponse(res, 400, error.message || 'Erreur lors de la remontée');
    }
  }

  /**
   * Régulariser une demande
   */
  async regulariser(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;

      // Récupérer demande
      const DemandeForçageModel = this.#getDemandeModel();
      const demande = await DemandeForçageModel.findById(id)
        .populate('clientId', 'nom prenom email cni');
      
      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      // Vérifier permissions
      const actionsDisponibles = WorkflowService.getAvailableActions(
        demande.statut,
        req.user.role,
        demande.montant,
        demande.notationClient || 'C'
      );

      if (!actionsDisponibles.includes(ACTIONS_DEMANDE.REGULARISER)) {
        return errorResponse(res, 403, 'Vous ne pouvez pas régulariser cette demande');
      }

      // Déterminer nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.REGULARISER,
        demande.statut,
        demande.montant,
        req.user.role,
        demande.notationClient || 'C',
        demande.agenceId
      );

      console.log('🔄 Régularisation:', demande.statut, '->', nouveauStatut);

      // Mettre à jour
      const updated = await this.#mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.REGULARISER,
        req.user.id,
        commentaire || `Demande régularisée par ${req.user.role}`,
        {
          regularisee: true,
          dateRegularisation: new Date()
        }
      );

      // Peupler les informations
      const demandePopulee = await DemandeForçageModel.findById(updated._id)
        .populate('clientId', 'nom prenom email cni');

      // Notification
      try {
        await this.#notifierRegularisation(demandePopulee, req.user);
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }

      console.log('✅ Demande régularisée');

      return successResponse(res, 200, 'Demande régularisée avec succès', {
        demande: {
          id: demandePopulee._id,
          numeroReference: demandePopulee.numeroReference,
          regularisee: demandePopulee.regularisee,
          dateRegularisation: demandePopulee.dateRegularisation,
          updatedAt: demandePopulee.updatedAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur régularisation:', error);
      return errorResponse(res, 400, error.message || 'Erreur lors de la régularisation');
    }
  }

  /**
   * Obtenir les statistiques
   */
  async getStatistiques(req, res) {
    try {
      const filters = this.#construireFiltresStatistiques(req);

      const stats = await DemandeForçageService.getStatistiques(filters);

      // Enrichir statistiques
      const statsEnrichies = await this.#enrichirStatistiques(stats, req.user);

      return successResponse(res, 200, 'Statistiques récupérées', {
        statistiques: statsEnrichies,
        periode: {
          dateDebut: filters.dateDebut,
          dateFin: filters.dateFin
        }
      });

    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération des statistiques', error.message);
    }
  }

  /**
   * Mettre à jour une demande
   */
  async mettreAJourDemande(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 400, 'Données invalides', errors.array());
      }

      const DemandeForçageModel = this.#getDemandeModel();
      
      // Vérifier permissions
      const demande = await DemandeForçageModel.findById(req.params.id)
        .populate('clientId', '_id');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }

      if (demande.clientId._id.toString() !== req.user.id && req.user.role !== 'admin') {
        return errorResponse(res, 403, 'Seul le propriétaire ou un admin peut modifier');
      }

      if (demande.statut !== STATUTS_DEMANDE.BROUILLON) {
        return errorResponse(res, 400, 'Seules les demandes brouillon peuvent être modifiées');
      }

      // Mettre à jour
      const demandeMaj = await DemandeForçageModel.findOneAndUpdate(
        { _id: req.params.id },
        { $set: req.body },
        { new: true }
      ).populate('clientId', 'nom prenom email cni');

      // Notification
      try {
        await this.#notifierModification(demandeMaj, req.user);
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }

      console.log('✅ Demande mise à jour');

      return successResponse(res, 200, 'Demande mise à jour avec succès', {
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
      console.error('❌ Erreur MAJ demande:', error);
      return errorResponse(res, 500, 'Erreur lors de la mise à jour', error.message);
    }
  }

  // ==================== MÉTHODES PRIVÉES ====================

  /**
   * Valider les données de création
   */
  #validerDonneesCreation(data) {
    const { motif, montant, typeOperation, dateEcheance } = data;

    if (!motif || typeof motif !== 'string' || motif.trim().length < 10 || motif.trim().length > 500) {
      return { valid: false, message: 'Motif requis (10-500 caractères)' };
    }

    if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
      return { valid: false, message: 'Montant invalide. Doit être un nombre positif' };
    }

    const montantNum = parseFloat(montant);
    if (montantNum > 100000000) { // 100 millions FCFA maximum
      return { valid: false, message: 'Montant trop élevé (max: 100.000.000 FCFA)' };
    }

    if (!typeOperation) {
      return { valid: false, message: 'Type d\'opération requis' };
    }

    const operationsValides = Object.values(TYPES_OPERATION);
    if (!operationsValides.includes(typeOperation.toUpperCase())) {
      return { valid: false, message: `Type d'opération invalide` };
    }

    return { valid: true };
  }

  /**
   * Calculer montant de forçage
   */
  #calculerMontantForçage(client, montantDemande) {
    const soldeActuel = client.soldeActuel || 0;
    const decouvertAutorise = client.decouvertAutorise || 0;
    return Math.max(0, montantDemande - (soldeActuel + decouvertAutorise));
  }

  /**
   * Traiter les fichiers uploadés
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
   * Construire données demande
   */
  async #construireDonneesDemande(options) {
    const {
      client,
      motif,
      motifDerogation,
      montantDemande,
      typeOperation,
      montantForçageTotal,
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

    // Générer référence
    const numeroReference = await this.#genererReference();

    // Calculer notation et priorité
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
      agenceId: client.agence || 'Agence Centrale',
      conseillerId: null,
      notationClient,
      classification: client.classification || 'normal',
      soldeActuel: client.soldeActuel || 0,
      decouvertAutorise: client.decouvertAutorise || 0,
      montantForçageTotal,
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
      historique: [{
        action: 'CREATION',
        statutAvant: null,
        statutApres: STATUTS_DEMANDE.BROUILLON,
        userId: user.id,
        commentaire: 'Demande créée via formulaire simple',
        timestamp: new Date()
      }]
    };

    // Gestion de la date d'échéance améliorée
    if (dateEcheance) {
      // Vérifier si c'est un nombre (mois) ou une date ISO
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
            // Date par défaut: J+15
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
   * Générer numéro de référence
   */
  async #genererReference() {
    try {
      const DemandeForçageModel = this.#getDemandeModel();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const prefix = `DF${year}${month}${day}`;

      // Chercher la dernière référence du jour
      const lastDemande = await DemandeForçageModel.findOne({
        numeroReference: new RegExp(`^${prefix}`)
      }).sort({ numeroReference: -1 });

      let sequence = 1;
      if (lastDemande && lastDemande.numeroReference) {
        const lastSeq = parseInt(lastDemande.numeroReference.slice(-4)) || 0;
        sequence = lastSeq + 1;
        
        // Si on dépasse 9999, on ajoute un suffixe
        if (sequence > 9999) {
          const suffix = String.fromCharCode(65 + Math.floor((sequence - 10000) / 1000));
          sequence = (sequence - 10000) % 1000;
          return `${prefix}${suffix}${String(sequence).padStart(3, '0')}`;
        }
      }

      return `${prefix}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
      console.warn('⚠️ Erreur génération référence, utilisation fallback');
      // Fallback avec timestamp plus UUID court
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      return `DF${timestamp}${random}`.toUpperCase();
    }
  }

  /**
   * Assigner conseiller automatiquement
   */
  async #assignerConseillerAutomatique(demandeId, agence) {
    try {
      const DemandeForçageModel = this.#getDemandeModel();
      const conseiller = await User.findOne({
        role: 'conseiller',
        agence: agence || 'Agence Centrale',
        isActive: true
      }).select('_id email nom prenom');

      if (conseiller) {
        await DemandeForçageModel.findByIdAndUpdate(demandeId, {
          $set: { conseillerId: conseiller._id }
        });

        try {
          await this.#notifierAssignationConseiller(demandeId, conseiller);
        } catch (notifError) {
          console.warn('⚠️ Erreur notification assignation:', notifError.message);
        }

        return conseiller;
      }

      console.warn('⚠️ Aucun conseiller disponible pour l\'agence:', agence);
      return null;
    } catch (error) {
      console.error('❌ Erreur assignation conseiller:', error);
      return null;
    }
  }

  /**
   * Mettre à jour statut demande
   */
  async #mettreAJourStatutDemande(demandeId, statutAvant, statutApres, action, userId, commentaire, updateData = {}) {
    const DemandeForçageModel = this.#getDemandeModel();
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

    return await DemandeForçageModel.findByIdAndUpdate(
      demandeId,
      update,
      { new: true }
    );
  }

  /**
   * Construire filtres selon rôle
   */
  #construireFiltres(req) {
    const { role, id: userId, agence, agencyId } = req.user;
    const { statut, priorite, dateDebut, dateFin } = req.query;

    const filters = {};

    console.log('🔍 [FILTERS] Building filters for role:', role);
    console.log('🔍 [FILTERS] User agence:', agence);
    console.log('🔍 [FILTERS] User agencyId:', agencyId);

    switch (role) {
      case 'client':
        filters.clientId = userId;
        console.log('🔍 [FILTERS] Client filter - clientId:', userId);
        break;

      case 'conseiller':
        // ✅ CORRECTION: Filtrer par agence ET/OU conseiller assigné
        filters.$or = [
          { conseillerId: userId }, // Demandes assignées à ce conseiller
          { 
            agenceId: agence, 
            conseillerId: null // Demandes non assignées dans cette agence
          }
        ];
        console.log('🔍 [FILTERS] Conseiller filter:', filters.$or);
        break;

      case 'rm':
      case 'dce':
        // ✅ CORRECTION: Utiliser agence (String) pour filtrer agenceId
        filters.agenceId = agence;
        console.log('🔍 [FILTERS] RM/DCE filter - agenceId:', agence);
        break;

      case 'admin':
      case 'dga':
      case 'risques':
      case 'adg':
        // Pas de filtre par défaut - voient tout
        console.log('🔍 [FILTERS] Admin/DGA/Risques/ADG - no filter');
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
   * Adapter réponse demandes selon rôle
   */
  async #adapterReponseDemandes(demandes, user) {
    const role = user.role;
    
    return demandes.map((demande, index) => {
      // Logging pour déboguer
      console.log(`🔍 Demande ${index}:`, {
        id: demande._id,
        ref: demande.numeroReference,
        clientId: demande.clientId,
        clientNom: demande.clientNom,
        clientPrenom: demande.clientPrenom,
        hasClientObject: !!demande.clientId && typeof demande.clientId === 'object'
      });

      // Extraire les informations client
      let clientNomComplet = 'N/A';
      let clientEmail = 'N/A';
      let clientCni = 'N/A';
      
      if (demande.clientId && typeof demande.clientId === 'object') {
        // Client est un objet populé
        clientNomComplet = `${demande.clientId.prenom || ''} ${demande.clientId.nom || ''}`.trim() || 'N/A';
        clientEmail = demande.clientId.email || 'N/A';
        clientCni = demande.clientId.cni || 'N/A';
      } else if (demande.clientNom && demande.clientPrenom) {
        // Utiliser les champs stockés directement
        clientNomComplet = `${demande.clientPrenom} ${demande.clientNom}`.trim();
        clientEmail = demande.clientEmail || 'N/A';
        // CNI n'est pas stocké directement, donc on garde 'N/A'
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
        clientNomComplet: clientNomComplet
      };

      // Infos supplémentaires selon rôle
      if (role !== 'client') {
        base.client = {
          id: demande.clientId?._id || demande.clientId,
          nom: demande.clientId?.nom || demande.clientNom || 'N/A',
          prenom: demande.clientId?.prenom || demande.clientPrenom || 'N/A',
          email: clientEmail,
          cni: clientCni, // ✅ AJOUTÉ
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
   * Vérifier permission sur demande
   */
  #verifierPermissionDemande(demande, user) {
    // Admins et rôles supérieurs voient tout
    if (['admin', 'dga', 'risques', 'adg'].includes(user.role)) return true;

    // Client voit ses demandes
    if (user.role === 'client') {
      const clientId = demande.clientId._id ? demande.clientId._id.toString() : demande.clientId.toString();
      return clientId === user.id;
    }

    // Conseiller voit les demandes de son agence (assignées ou non)
    if (user.role === 'conseiller') {
      // Peut voir les demandes assignées à lui
      if (demande.conseillerId) {
        const conseillerId = demande.conseillerId._id ? demande.conseillerId._id.toString() : demande.conseillerId.toString();
        if (conseillerId === user.id) return true;
      }
      
      // Peut aussi voir les demandes de son agence (même si non assignées)
      return demande.agenceId === user.agence;
    }

    // RM/DCE voient les demandes de leur agence
    if (['rm', 'dce'].includes(user.role)) {
      return demande.agenceId === user.agence;
    }

    return false;
  }

  /**
   * Formater réponse détaillée
   */
  // src/controllers/demandeForçage.controller.js - VERSION CORRIGÉE COMPLÈTE

// Dans la méthode #formaterReponseDemande, remplacer par :

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
    
    // ✅ AJOUT DES CHAMPS MANQUANTS
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

  // Infos client complètes
  base.client = {
    id: demande.clientId._id ? demande.clientId._id : demande.clientId,
    nom: demande.clientId.nom || demande.clientNom || 'N/A',
    prenom: demande.clientId.prenom || demande.clientPrenom || 'N/A',
    email: demande.clientId.email || demande.clientEmail || 'N/A',
    telephone: demande.clientId.telephone || demande.clientTelephone || 'N/A',
    cni: demande.clientId?.cni || 'N/A', // ✅ AJOUTÉ
    numeroCompte: demande.clientId?.numeroCompte || demande.compteNumero || 'N/A', // ✅ AJOUTÉ
    agence: demande.clientId?.agence || demande.agenceId || 'N/A', // ✅ AJOUTÉ
    nomComplet: demande.clientNomComplet || 
      `${demande.clientId?.prenom || demande.clientPrenom || ''} ${demande.clientId?.nom || demande.clientNom || ''}`.trim()
  };

  // Infos supplémentaires selon rôle
  if (user.role !== 'client') {
    base.client.notationClient = demande.notationClient || 'C';
    base.client.classification = demande.classification;

    base.agenceId = demande.agenceId;
    base.conseiller = demande.conseillerId;
    base.montantAutorise = demande.montantAutorise;
    base.commentaireTraitement = demande.commentaireTraitement;
    base.piecesJustificatives = demande.piecesJustificatives;
    base.commentaireInterne = demande.commentaireInterne; // ✅ AJOUTÉ

    if (['admin', 'dga', 'adg', 'risques'].includes(user.role)) {
      base.soldeActuel = demande.soldeActuel;
      base.decouvertAutorise = demande.decouvertAutorise;
      base.montantForçageTotal = demande.montantForçageTotal;
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
   * Vérifier si peut soumettre
   */
  #peutSoumettreDemande(demande, user) {
    const clientId = demande.clientId._id ? demande.clientId._id.toString() : demande.clientId.toString();
    return clientId === user.id.toString() &&
      demande.statut === STATUTS_DEMANDE.BROUILLON;
  }

  /**
   * Vérifier si peut annuler
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
      const DemandeForçageModel = this.#getDemandeModel();
      const statsAgence = await DemandeForçageModel.aggregate([
        {
          $group: {
            _id: '$agenceId',
            total: { $sum: 1 },
            montantTotal: { $sum: '$montant' },
            montantForçageTotal: { $sum: '$montantForçageTotal' },
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
   * Obtenir le modèle DemandeForçage
   */
  #getDemandeModel() {
    return require('../models/DemandeForçage');
  }

  // ==================== NOTIFICATIONS ====================

  async #notifierCreation(demande, user) {
    try {
      // Utiliser l'ID du user connecté (qui est le client)
      const clientId = user.id || user._id;
      
      console.log('📧 Envoi notification création:', {
        clientId: clientId.toString(),
        userId: user.id,
        demandeRef: demande.numeroReference,
        demandeId: demande._id.toString(),
        userRole: user.role
      });
      
      const result = await NotificationService.createNotification({
        utilisateur: clientId,
        titre: '✅ Demande créée',
        message: `Votre demande ${demande.numeroReference} a été créée avec succès`,
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
      
      console.log('✅ Notification création envoyée:', result._id);
    } catch (error) {
      console.error('❌ Erreur notification création:', error.message);
    }
  }

  async #notifierSoumission(demande, user) {
    try {
      // Utiliser l'ID du user connecté (qui est le client)
      const clientId = user.id || user._id;
      
      console.log('📧 Envoi notification soumission:', {
        clientId: clientId.toString(),
        userId: user.id,
        demandeRef: demande.numeroReference,
        demandeId: demande._id.toString(),
        userRole: user.role
      });
      
      const result = await NotificationService.createNotification({
        utilisateur: clientId,
        titre: '📤 Demande soumise',
        message: `Votre demande ${demande.numeroReference} a été soumise pour traitement`,
        entite: 'demande',
        entiteId: demande._id,
        type: 'info',
        categorie: 'demande_soumission',
        priorite: 'normale',
        lien: `/demandes/${demande._id}`,
        metadata: {
          demandeId: demande._id.toString(),
          statut: demande.statut,
          submittedBy: user.id
        },
        tags: ['demande', 'soumission']
      });
      
      console.log('✅ Notification soumission envoyée:', result._id);
    } catch (error) {
      console.error('❌ Erreur notification soumission:', error.message);
    }
  }

  async #notifierAnnulation(demande, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;
      
      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: '❌ Demande annulée',
        message: `Votre demande ${demande.numeroReference} a été annulée`,
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
      console.warn('⚠️ Erreur notification annulation:', error.message);
    }
  }

  async #notifierModification(demande, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;
      
      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: '✏️ Demande modifiée',
        message: `Votre demande ${demande.numeroReference} a été mise à jour`,
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
      console.warn('⚠️ Erreur notification modification:', error.message);
    }
  }

  async #notifierTraitement(demande, nouveauStatut, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;
      
      const statutMessages = {
        'APPROUVEE': 'a été approuvée ✅',
        'REJETEE': 'a été rejetée ❌',
        'EN_COURS': 'est en cours de traitement 🔄',
        'DECAISSEE': 'a été décaissée 💰',
        'REGULARISEE': 'a été régularisée ✅'
      };

      const message = statutMessages[nouveauStatut] || `a changé de statut: ${nouveauStatut}`;
      
      console.log('📧 Envoi notification traitement:', {
        clientId: clientId.toString(),
        demandeRef: demande.numeroReference,
        demandeId: demande._id,
        nouveauStatut: nouveauStatut
      });
      
      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: `📋 Demande ${demande.numeroReference} - ${nouveauStatut}`,
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
      
      console.log('✅ Notification traitement envoyée');
    } catch (error) {
      console.warn('⚠️ Erreur notification traitement:', error.message);
    }
  }

  async #notifierRegularisation(demande, user) {
    try {
      const clientId = demande.clientId._id ? demande.clientId._id : demande.clientId;
      
      await NotificationService.createNotification({
        utilisateur: clientId,
        titre: '✅ Demande régularisée',
        message: `Votre demande ${demande.numeroReference} a été régularisée`,
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
      console.warn('⚠️ Erreur notification régularisation:', error.message);
    }
  }

  async #notifierAssignationConseiller(demandeId, conseiller) {
    try {
      await NotificationService.createNotification({
        utilisateur: conseiller._id,
        titre: '📋 Nouvelle demande assignée',
        message: `Une demande vous a été assignée`,
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
      console.warn('⚠️ Erreur notification assignation:', error.message);
    }
  }

  async #notifierChangementStatut(demande, nouveauStatut, user) {
    try {
      // Déléguer à #notifierTraitement pour éviter la duplication
      await this.#notifierTraitement(demande, nouveauStatut, user);
    } catch (error) {
      console.warn('⚠️ Erreur notification changement statut:', error.message);
    }
  }
}

// Créer une instance et binder les méthodes
const controller = new DemandeForçageController();

// Exporter les méthodes bindées
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