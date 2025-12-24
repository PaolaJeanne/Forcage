// src/controllers/demandeForçage.controller.js - VERSION ARRANGÉE
const DemandeForçageService = require('../services/demandeForcage.service');
const WorkflowService = require('../services/workflow.service');
const {
  STATUTS_DEMANDE,
  ACTIONS_DEMANDE,
  PRIORITES,
  NOTATIONS_CLIENT,
  TYPES_OPERATION
} = require('../constants/roles');
const { validationResult } = require('express-validator');
const { successResponse, errorResponse } = require('../utils/response.util');

const User = require('../models/User');
const NotificationService = require('../services/notification.service');

class DemandeForçageController {

  // ==================== VARIABLES PRIVÉES ====================
  #DemandeForçage = null;
  #Notification = null;

  constructor() {
    this.#initializeModels();
  }

  #initializeModels() {
    this.#DemandeForçage = require('../models/DemandeForçage');
    this.#Notification = require('../models/Notification');
  }

  // ==================== MÉTHODES PUBLIQUES ====================

  /**
   * Créer une nouvelle demande
   */
  async creerDemande(req, res) {
    try {


      // Vérification rôle client
      if (req.user.role !== 'client') {
        return errorResponse(res, 403, 'Seuls les clients peuvent créer des demandes');
      }

      const {
        motif,
        montant,
        typeOperation,
        dateEcheance,
        compteDebit,
        compteNumero,
        devise,
        commentaireInterne
      } = req.body;

      // Validation
      const validation = this.#validerDonneesCreation({
        motif,
        montant,
        typeOperation,
        dateEcheance
      });

      if (!validation.valid) {
        return errorResponse(res, 400, validation.message);
      }

      // Récupérer client
      const client = await User.findById(req.user.id);
      if (!client) {
        return errorResponse(res, 404, 'Client introuvable');
      }

      // Calculer montants
      const montantDemande = parseFloat(montant);
      const montantForçageTotal = this.#calculerMontantForçage(client, montantDemande);

      // Traiter fichiers
      const piecesJustificatives = this.#traiterFichiersUpload(req.files);

      // Construire données demande
      const demandeData = await this.#construireDonneesDemande({
        client,
        motif,
        montantDemande,
        typeOperation,
        montantForçageTotal,
        piecesJustificatives,
        dateEcheance,
        compteDebit,
        compteNumero,
        devise,
        commentaireInterne,
        user: req.user
      });

      // Créer demande
      const nouvelleDemande = await this.#DemandeForçage.create(demandeData);

      // Assigner conseiller
      await this.#assignerConseillerAutomatique(nouvelleDemande._id, demandeData.agenceId);

      // Notification
      await this.#notifierCreation(nouvelleDemande, req.user);



      // Réponse
      return successResponse(res, 201, 'Demande créée avec succès', {
        demande: {
          id: nouvelleDemande._id,
          numeroReference: nouvelleDemande.numeroReference,
          statut: nouvelleDemande.statut,
          montant: nouvelleDemande.montant,
          typeOperation: nouvelleDemande.typeOperation,
          scoreRisque: nouvelleDemande.scoreRisque,
          priorite: nouvelleDemande.priorite,
          dateEcheance: nouvelleDemande.dateEcheance,
          piecesJustificatives: nouvelleDemande.piecesJustificatives,
          createdAt: nouvelleDemande.createdAt
        },
        workflowInfo: {
          prochainesActions: WorkflowService.getAvailableActions(
            STATUTS_DEMANDE.BROUILLON,
            req.user.role,
            nouvelleDemande.montant,
            nouvelleDemande.notationClient,
            true
          ),
          statutActuel: STATUTS_DEMANDE.BROUILLON,
          responsable: WorkflowService.getResponsibleRole(STATUTS_DEMANDE.BROUILLON)
        }
      });

    } catch (error) {

      return errorResponse(res, 500, 'Erreur lors de la création', error.message);
    }
  }

  /**
   * Lister les demandes selon le rôle
   */
  async listerDemandes(req, res) {
    try {
      const filters = this.#construireFiltres(req);
      const options = this.#construireOptions(req);

      const result = await DemandeForçageService.listerDemandes(filters, options);

      // Adapter la réponse
      const demandesAdaptees = this.#adapterReponseDemandes(result.demandes, req.user.role);

      // Ajouter actions disponibles
      const demandesAvecActions = demandesAdaptees.map(demande => ({
        ...demande,
        actionsDisponibles: this.#getActionsDisponibles(demande, req.user)
      }));

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

      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  }

  /**
   * Consulter une demande spécifique
   */
  async getDemande(req, res) {
    try {
      const demande = await DemandeForçageService.getDemandeById(req.params.id);

      // Vérifier permissions
      if (!this.#verifierPermissionDemande(demande, req.user)) {
        return errorResponse(res, 403, 'Accès non autorisé à cette demande');
      }

      // Formater réponse
      const reponseFormatee = this.#formaterReponseDemande(demande, req.user);

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

      return successResponse(res, 200, 'Détails de la demande', {
        demande: reponseFormatee
      });

    } catch (error) {

      return errorResponse(res, 404, error.message);
    }
  }

  /**
   * Soumettre une demande brouillon
   */
  async soumettreDemande(req, res) {
    try {


      const { id } = req.params;
      const { commentaire } = req.body || {}; // <-- CORRECTION



      // Récupérer demande
      const demande = await this.#DemandeForçage.findById(id);
      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }



      // Vérifier permissions
      if (!this.#peutSoumettreDemande(demande, req.user)) {

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



      // Mettre à jour demande
      const updated = await this.#mettreAJourStatutDemande(
        id,
        demande.statut,
        nouveauStatut,
        ACTIONS_DEMANDE.SOUMETTRE,
        req.user.id,
        commentaire || 'Demande soumise pour traitement', // <-- Ici commentaire peut être undefined
        { dateSoumission: new Date() }
      );

      // Assigner conseiller si nécessaire
      if (!updated.conseillerId) {
        await this.#assignerConseillerAutomatique(updated._id, updated.agenceId);
      }

      // Notification
      await this.#notifierSoumission(updated, req.user);



      return successResponse(res, 200, 'Demande soumise avec succès', {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          statut: updated.statut,
          updatedAt: updated.updatedAt,
          conseiller: updated.conseillerId
        },
        workflowInfo: {
          prochainesActions: WorkflowService.getAvailableActions(
            nouveauStatut,
            'conseiller',
            updated.montant,
            updated.notationClient || 'C'
          ),
          responsable: WorkflowService.getResponsibleRole(nouveauStatut),
          delaiEstime: WorkflowService.calculatePriority(
            updated.dateEcheance || new Date(),
            updated.montant,
            updated.notationClient || 'C',
            updated.typeOperation
          )
        }
      });

    } catch (error) {

      return errorResponse(res, 500, 'Erreur soumission demande', error.message);
    }
  }

  /**
   * Annuler une demande
   */
  async annulerDemande(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body || {};

      const demande = await this.#DemandeForçage.findById(id);

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

      // Notification
      await this.#notifierAnnulation(updated, req.user);



      return successResponse(res, 200, 'Demande annulée avec succès', {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          statut: updated.statut,
          updatedAt: updated.updatedAt
        }
      });

    } catch (error) {

      return errorResponse(res, 400, error.message);
    }
  }

  /**
   * Traiter une demande (validation, rejet, etc.)
   */
  async traiterDemande(req, res) {
    try {


      const { id } = req.params;
      const { action, commentaire, montantAutorise } = req.body;

      if (!action) {
        return errorResponse(res, 400, 'L\'action est requise (VALIDER, REJETER, etc.)');
      }

      // Récupérer demande
      const demande = await this.#DemandeForçage.findById(id)
        .populate('clientId', 'email nom')
        .populate('conseillerId', 'email nom');

      if (!demande) {
        return errorResponse(res, 404, 'Demande non trouvée');
      }



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



      // Préparer données de mise à jour
      const updateData = {};
      if (action === ACTIONS_DEMANDE.VALIDER && montantAutorise) {
        updateData.montantAutorise = parseFloat(montantAutorise);
      }

      // Si validation par RM/DCE/ADG
      if (action === ACTIONS_DEMANDE.VALIDER && ['rm', 'dce', 'adg'].includes(req.user.role)) {
        updateData[`validePar_${req.user.role}`] = {
          userId: req.user.id,
          date: new Date(),
          commentaire: commentaire
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

      // Notification




      return successResponse(res, 200, `Demande ${action.toLowerCase()} avec succès`, {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          statut: updated.statut,
          montantAutorise: updated.montantAutorise,
          dateEcheance: updated.dateEcheance,
          updatedAt: updated.updatedAt,
          conseiller: updated.conseillerId
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
            updated.montant,
            updated.notationClient || 'C'
          ),
          responsable: WorkflowService.getResponsibleRole(nouveauStatut),
          delaiEstime: WorkflowService.calculatePriority(
            updated.dateEcheance || new Date(),
            updated.montant,
            updated.notationClient || 'C',
            updated.typeOperation
          )
        }
      });

    } catch (error) {

      return errorResponse(res, 500, 'Erreur traitement demande', error.message);
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
      const demande = await this.#DemandeForçage.findById(id);
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
      await this.#notifierChangementStatut(updated, nouveauStatut, req.user);



      return successResponse(res, 200, 'Demande remontée au niveau supérieur', {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          statut: updated.statut,
          updatedAt: updated.updatedAt
        }
      });

    } catch (error) {

      return errorResponse(res, 400, error.message);
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
      const demande = await this.#DemandeForçage.findById(id);
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

      // Notification
      await this.#notifierRegularisation(updated, req.user);



      return successResponse(res, 200, 'Demande régularisée avec succès', {
        demande: {
          id: updated._id,
          numeroReference: updated.numeroReference,
          regularisee: updated.regularisee,
          dateRegularisation: updated.dateRegularisation,
          updatedAt: updated.updatedAt
        }
      });

    } catch (error) {

      return errorResponse(res, 400, error.message);
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

      return errorResponse(res, 500, 'Erreur serveur', error.message);
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

      // Vérifier permissions
      const demande = await DemandeForçageService.getDemandeById(req.params.id);

      if (demande.clientId._id.toString() !== req.user.id && req.user.role !== 'admin') {
        return errorResponse(res, 403, 'Seul le propriétaire ou un admin peut modifier');
      }

      if (demande.statut !== STATUTS_DEMANDE.BROUILLON) {
        return errorResponse(res, 400, 'Seules les demandes brouillon peuvent être modifiées');
      }

      // Mettre à jour
      const demandeMaj = await this.#DemandeForçage.findOneAndUpdate(
        { _id: req.params.id },
        { $set: req.body },
        { new: true }
      ).populate('clientId', 'nom prenom email');

      // Notification
      await this.#notifierModification(demandeMaj, req.user);



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
      return { valid: false, message: 'Montant invalide' };
    }

    if (!typeOperation) {
      return { valid: false, message: 'Type d\'opération requis' };
    }

    const operationsValides = ['VIREMENT', 'PRELEVEMENT', 'CHEQUE', 'CARTE', 'RETRAIT', 'AUTRE'];
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
      montantDemande,
      typeOperation,
      montantForçageTotal,
      piecesJustificatives,
      dateEcheance,
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
      scoreRisque: WorkflowService.calculateRiskLevel(montantDemande, notationClient),
      piecesJustificatives,
      devise: devise || 'XAF',
      historique: [{
        action: 'CREATION',
        statutAvant: null,
        statutApres: STATUTS_DEMANDE.BROUILLON,
        userId: user.id,
        commentaire: 'Demande créée',
        timestamp: new Date()
      }]
    };

    // Champs optionnels
    if (dateEcheance) demandeData.dateEcheance = new Date(dateEcheance);
    if (compteDebit) demandeData.compteDebit = compteDebit;
    if (commentaireInterne) demandeData.commentaireInterne = commentaireInterne;

    return demandeData;
  }

  /**
   * Générer numéro de référence
   */
  async #genererReference() {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `DF${year}${month}`;

      const lastDemande = await this.#DemandeForçage.findOne({
        numeroReference: new RegExp(`^${prefix}`)
      }).sort({ numeroReference: -1 });

      let sequence = 1;
      if (lastDemande && lastDemande.numeroReference) {
        const lastSeq = parseInt(lastDemande.numeroReference.slice(-4)) || 0;
        sequence = lastSeq + 1;
      }

      return `${prefix}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
      return `DF${Date.now().toString().slice(-8)}`;
    }
  }

  /**
   * Assigner conseiller automatiquement
   */
  async #assignerConseillerAutomatique(demandeId, agence) {
    try {
      const conseiller = await User.findOne({
        role: 'conseiller',
        agence: agence || 'Agence Centrale',
        isActive: true
      }).select('_id email');

      if (conseiller) {
        await this.#DemandeForçage.findByIdAndUpdate(demandeId, {
          $set: { conseillerId: conseiller._id }
        });

        await this.#notifierAssignationConseiller(demandeId, conseiller._id);

        return conseiller;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Mettre à jour statut demande
   */
  async #mettreAJourStatutDemande(demandeId, statutAvant, statutApres, action, userId, commentaire, updateData = {}) {
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

    return await this.#DemandeForçage.findByIdAndUpdate(
      demandeId,
      update,
      { new: true }
    );
  }

  /**
   * Construire filtres selon rôle
   */
  #construireFiltres(req) {
  const { role, id: userId, agence, email } = req.user;

  const filters = {};

  switch (role) {
    case 'client':
      filters.clientId = userId;
      break;

    case 'conseiller':
      // Option 1: Le conseiller voit les demandes qui lui sont assignées
      filters.conseillerId = userId;
      
      // Option 2: OU les demandes de son agence qui sont en attente
      // filters.$or = [
      //   { conseillerId: userId },
      //   { 
      //     $and: [
      //       { agenceId: agence },
      //       { statut: { $in: ['EN_ATTENTE_CONSEILLER', 'EN_ETUDE_CONSEILLER'] } }
      //     ]
      //   }
      // ];
      break;

    case 'rm':
    case 'dce':
      filters.agenceId = agence; // Note: Le champ est agenceId, pas agence
      break;

    case 'admin':
    case 'dga':
    case 'risques':
      // Pas de filtre - voient tout
      break;

    default:
      filters.clientId = userId;
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
  #adapterReponseDemandes(demandes, role) {
    return demandes.map(demande => {
      const base = {
        id: demande._id,
        numeroReference: demande.numeroReference,
        statut: demande.statut,
        montant: demande.montant,
        typeOperation: demande.typeOperation,
        scoreRisque: demande.scoreRisque,
        priorite: demande.priorite || 'NORMALE',
        createdAt: demande.createdAt,
        enRetard: demande.enRetard,
        joursRestants: demande.dateEcheance ?
          Math.ceil((new Date(demande.dateEcheance) - new Date()) / (1000 * 60 * 60 * 24)) : null
      };

      // Infos supplémentaires selon rôle
      if (role !== 'client') {
        base.client = demande.clientId ? {
          id: demande.clientId._id,
          nom: demande.clientId.nom,
          prenom: demande.clientId.prenom,
          agence: demande.agenceId
        } : null;

        if (['conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'].includes(role)) {
          base.conseiller = demande.conseillerId;
          base.notationClient = demande.notationClient || 'C';
          base.agenceId = demande.agenceId;
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
    // Admins voient tout
    if (['admin', 'dga', 'risques'].includes(user.role)) return true;

    // Client voit ses demandes
    if (user.role === 'client' && demande.clientId._id.toString() === user.id) return true;

    // Conseiller voit ses demandes assignées
    if (user.role === 'conseiller' && demande.conseillerId && demande.conseillerId._id.toString() === user.id) return true;

    // RM/DCE voient les demandes de leur agence
    if (['rm', 'dce'].includes(user.role)) {
      return demande.agenceId === user.agence;
    }

    // ADG peut voir toutes les demandes
    if (user.role === 'adg') return true;

    return false;
  }

  /**
   * Formater réponse détaillée
   */
  #formaterReponseDemande(demande, user) {
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
      enRetard: demande.enRetard,
      joursRestants: demande.dateEcheance ?
        Math.ceil((new Date(demande.dateEcheance) - new Date()) / (1000 * 60 * 60 * 24)) : null
    };

    // Infos client
    base.client = {
      id: demande.clientId._id,
      nom: demande.clientId.nom,
      prenom: demande.clientId.prenom
    };

    // Infos supplémentaires selon rôle
    if (user.role !== 'client') {
      base.client.email = demande.clientId.email;
      base.client.telephone = demande.clientId.telephone;
      base.client.notationClient = demande.clientId.notationClient;
      base.client.classification = demande.clientId.classification;

      base.agenceId = demande.agenceId;
      base.conseiller = demande.conseillerId;
      base.montantAutorise = demande.montantAutorise;
      base.dateEcheance = demande.dateEcheance;
      base.commentaireTraitement = demande.commentaireTraitement;

      if (['admin', 'dga', 'adg', 'risques'].includes(user.role)) {
        base.soldeActuel = demande.soldeActuel;
        base.decouvertAutorise = demande.decouvertAutorise;
        base.montantForçageTotal = demande.montantForçageTotal;
        base.historique = demande.historique;
      }
    }

    return base;
  }

  /**
   * Vérifier si peut soumettre
   */
  #peutSoumettreDemande(demande, user) {
    return demande.clientId.toString() === user.id.toString() &&
      demande.statut === STATUTS_DEMANDE.BROUILLON;
  }

  /**
   * Vérifier si peut annuler
   */
  #peutAnnulerDemande(demande, user) {
    return demande.clientId.toString() === user.id.toString() || user.role === 'admin';
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
      const statsAgence = await this.#DemandeForçage.aggregate([
        {
          $group: {
            _id: '$agenceId',
            total: { $sum: 1 },
            montantTotal: { $sum: '$montant' }
          }
        }
      ]);

      enrichies.parAgence = statsAgence;

      // Taux
      if (stats.total > 0) {
        enrichies.tauxValidation = (stats.validees / stats.total) * 100;
        enrichies.tauxRefus = (stats.refusees / stats.total) * 100;
      }
    }

    return enrichies;
  }

  // ==================== NOTIFICATIONS ====================

  async #notifierCreation(demande, user) {
    try {
      if (NotificationService.create) {
        await NotificationService.create({
          utilisateur: user.id,
          type: 'success',
          titre: 'Demande créée',
          message: `Votre demande #${demande.numeroReference} a été créée avec succès`,
          entite: 'demande',
          entiteId: demande._id,
          lien: `/demandes/${demande._id}`,
          lue: false,
          metadata: {
            demandeId: demande._id,
            montant: demande.montant,
            typeOperation: demande.typeOperation
          }
        });
      }
    } catch (error) {
    }
  }

  async #notifierSoumission(demande, user) {
    try {
      if (NotificationService.create) {
        await NotificationService.create({
          utilisateur: user.id,
          type: 'info',
          titre: 'Demande soumise',
          message: `Votre demande #${demande.numeroReference} a été soumise pour traitement`,
          entite: 'demande',
          entiteId: demande._id,
          lien: `/demandes/${demande._id}`,
          lue: false
        });
      }
    } catch (error) {
    }
  }

  async #notifierAnnulation(demande, user) {
    try {
      if (NotificationService.create) {
        await NotificationService.create({
          utilisateur: user.id,
          type: 'warning',
          titre: 'Demande annulée',
          message: `Votre demande #${demande.numeroReference} a été annulée`,
          entite: 'demande',
          entiteId: demande._id,
          lien: `/demandes/${demande._id}`,
          lue: false
        });
      }
    } catch (error) {
    }
  }

  async #notifierModification(demande, user) {
    try {
      if (NotificationService.create) {
        await NotificationService.create({
          utilisateur: user.id,
          type: 'info',
          titre: 'Demande modifiée',
          message: `Votre demande #${demande.numeroReference} a été mise à jour`,
          entite: 'demande',
          entiteId: demande._id,
          lien: `/demandes/${demande._id}`,
          lue: false
        });
      }
    } catch (error) {
    }
  }

  async #notifierTraitement(demande, nouveauStatut, user) {
    await this.#notifierChangementStatut(demande, nouveauStatut, user);
  }

  async #notifierRegularisation(demande, user) {
    try {
      if (NotificationService.create) {
        await NotificationService.create({
          utilisateur: demande.clientId,
          type: 'success',
          titre: 'Demande régularisée',
          message: `Votre demande #${demande.numeroReference} a été régularisée`,
          entite: 'demande',
          entiteId: demande._id,
          lien: `/demandes/${demande._id}`,
          lue: false
        });
      }
    } catch (error) {
    }
  }

  async #notifierAssignationConseiller(demandeId, conseillerId) {
    try {
      const demande = await this.#DemandeForçage.findById(demandeId);
      if (!demande) return;

      await this.#Notification.create({
        utilisateur: conseillerId,
        type: 'demande_assignee',
        titre: 'Nouvelle demande assignée',
        message: `Demande ${demande.numeroReference} assignée à vous`,
        entite: 'demande',
        entiteId: demandeId,
        lue: false,
        createdAt: new Date()
      });

    } catch (error) {
    }
  }

  async #notifierChangementStatut(demande, nouveauStatut, user) {
    try {
      // Envoyer notifications
      if (notifications.length > 0) {
        await this.#Notification.insertMany(notifications);
      }

    } catch (error) {
    }
  }
}

const demandeControllerInstance = new DemandeForçageController();

module.exports = demandeControllerInstance;