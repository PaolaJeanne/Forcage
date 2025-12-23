// src/services/demandeForçage.service.js - SERVICE COMPLET
const DemandeForçage = require('../models/DemandeForçage');
const User = require('../models/User');
const {
  STATUTS_DEMANDE,
  ACTIONS_DEMANDE,
  LIMITES_AUTORISATION,
  HIERARCHY
} = require('../constants/roles');
const WorkflowService = require('./workflow.service');
const mongoose = require('mongoose');

class DemandeForçageService {

  // ==================== CRÉATION ====================
  static async creerDemande(clientId, demandeData) {
    try {


      // Vérifier que le client existe
      const client = await User.findById(clientId);
      if (!client) {
        throw new Error('Client introuvable');
      }

      // Générer le numéro de référence
      const numeroReference = await DemandeForçage.generateNextReference();

      // Créer la demande
      const demande = new DemandeForçage({
        ...demandeData,
        numeroReference,
        clientId,
        statut: STATUTS_DEMANDE.BROUILLON
      });

      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== LISTAGE ====================
  static async listerDemandes(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 20, sort = '-createdAt' } = options;
      const skip = (page - 1) * limit;

      // Construire la query
      let query = {};

      // Appliquer les filtres
      if (filters.clientId) query.clientId = filters.clientId;
      if (filters.conseillerId) query.conseillerId = filters.conseillerId;
      if (filters.agenceId) query.agenceId = filters.agenceId;
      if (filters.statut) query.statut = filters.statut;
      if (filters.scoreRisque) query.scoreRisque = filters.scoreRisque;
      if (filters.typeOperation) query.typeOperation = filters.typeOperation;
      if (filters.priorite) query.priorite = filters.priorite;
      if (filters.createdAt) query.createdAt = filters.createdAt;

      // Recherche par motif
      if (filters.search) {
        query.$or = [
          { numeroReference: { $regex: filters.search, $options: 'i' } },
          { motif: { $regex: filters.search, $options: 'i' } },
          { 'clientId.nom': { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Exécuter la requête
      const [demandes, total] = await Promise.all([
        DemandeForçage.find(query)
          .populate('clientId', 'nom prenom email notationClient classification')
          .populate('conseillerId', 'nom prenom email')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        DemandeForçage.countDocuments(query)
      ]);

      // Calculer la pagination
      const totalPages = Math.ceil(total / limit);

      return {
        demandes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {

      throw error;
    }
  }

  // ==================== CONSULTATION ====================
  static async getDemandeById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('ID de demande invalide');
      }

      const demande = await DemandeForçage.findById(id)
        .populate('clientId', 'nom prenom email telephone notationClient classification')
        .populate('conseillerId', 'nom prenom email telephone')
        .lean();

      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== SOUMISSION ====================
  static async soumettreDemande(demandeId, userId) {
    try {


      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      // Vérifier que c'est le propriétaire
      if (demande.clientId.toString() !== userId.toString()) {
        throw new Error('Seul le propriétaire peut soumettre la demande');
      }

      // Vérifier le statut
      if (demande.statut !== STATUTS_DEMANDE.BROUILLON) {
        throw new Error(`La demande n'est plus en brouillon (statut: ${demande.statut})`);
      }

      // Déterminer le prochain statut via WorkflowService
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.SOUMETTRE,
        demande.statut,
        demande.montant,
        'client',
        demande.notationClient,
        demande.agenceId
      );

      // Mettre à jour
      demande.statut = nouveauStatut;
      demande.dateSoumission = new Date();
      demande.addHistoryEntry(ACTIONS_DEMANDE.SOUMETTRE, userId, 'Demande soumise');

      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== TRAITEMENT ====================
  static async traiterDemande(demandeId, userId, action, options = {}) {
    try {


      const { commentaire, montantAutorise, conditionsParticulieres } = options;

      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      // Vérifier que l'utilisateur peut traiter cette demande
      if (!demande.canBeProcessedBy({ id: userId, role: await this.getUserRole(userId) })) {
        throw new Error('Vous ne pouvez pas traiter cette demande');
      }

      // Vérifier les actions disponibles
      const userRole = await this.getUserRole(userId);
      const actionsDisponibles = demande.getAvailableActions({
        id: userId,
        role: userRole
      });

      if (!actionsDisponibles.includes(action)) {
        throw new Error(`Action "${action}" non autorisée`);
      }

      // Vérifier les limites d'autorisation pour la validation
      if (action === ACTIONS_DEMANDE.VALIDER) {
        const montant = montantAutorise || demande.montant;
        const limite = LIMITES_AUTORISATION[userRole];

        if (limite !== undefined && limite !== Infinity && montant > limite) {
          throw new Error(`Montant (${montant}) dépasse votre limite d'autorisation (${limite})`);
        }
      }

      // Déterminer le nouveau statut via WorkflowService
      const nouveauStatut = WorkflowService.getNextStatus(
        action,
        demande.statut,
        montantAutorise || demande.montant,
        userRole,
        demande.notationClient,
        demande.agenceId
      );

      // Mettre à jour la demande
      const updateData = {
        statut: nouveauStatut,
        updatedAt: new Date()
      };

      // Ajouter des données spécifiques selon l'action
      if (action === ACTIONS_DEMANDE.VALIDER) {
        updateData.montantAutorise = montantAutorise || demande.montant;
        updateData.dateValidation = new Date();

        // Enregistrer qui a validé
        if (['conseiller', 'rm', 'dce', 'adg'].includes(userRole)) {
          updateData[`validePar_${userRole}`] = {
            userId,
            date: new Date(),
            commentaire
          };
        }
      } else if (action === ACTIONS_DEMANDE.DECAISSER) {
        updateData.dateDecaissement = new Date();
      } else if (action === ACTIONS_DEMANDE.REGULARISER) {
        updateData.dateRegularisation = new Date();
        updateData.regularisee = true;
      } else if (action === ACTIONS_DEMANDE.REJETER) {
        updateData.dateAnnulation = new Date();
      }

      if (conditionsParticulieres) {
        updateData.conditionsParticulieres = conditionsParticulieres;
      }

      if (commentaire) {
        updateData.commentaireTraitement = commentaire;
      }

      // Ajouter à l'historique
      demande.addHistoryEntry(action, userId, commentaire || `${action} par ${userRole}`);
      updateData.historique = demande.historique;

      // Appliquer les mises à jour
      Object.assign(demande, updateData);
      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== REMONTÉE HIÉRARCHIQUE ====================
  static async remonterDemande(demandeId, userId, commentaire) {
    try {


      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      const userRole = await this.getUserRole(userId);

      // Vérifier que l'utilisateur peut remonter
      if (!['conseiller', 'rm', 'dce'].includes(userRole)) {
        throw new Error('Vous ne pouvez pas remonter cette demande');
      }

      // Déterminer le nouveau statut via WorkflowService
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.REMONTER,
        demande.statut,
        demande.montant,
        userRole,
        demande.notationClient,
        demande.agenceId
      );

      // Mettre à jour
      demande.statut = nouveauStatut;
      demande.addHistoryEntry(ACTIONS_DEMANDE.REMONTER, userId, commentaire || 'Remontée hiérarchique');

      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== ANNULATION ====================
  static async annulerDemande(demandeId, userId) {
    try {


      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      const userRole = await this.getUserRole(userId);

      // Seul le client peut annuler, sauf admin
      if (demande.clientId.toString() !== userId.toString() && userRole !== 'admin') {
        throw new Error('Seul le client peut annuler sa demande');
      }

      // Déterminer le nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.ANNULER,
        demande.statut,
        demande.montant,
        userRole,
        demande.notationClient,
        demande.agenceId
      );

      // Mettre à jour
      demande.statut = nouveauStatut;
      demande.dateAnnulation = new Date();
      demande.addHistoryEntry(ACTIONS_DEMANDE.ANNULER, userId, 'Demande annulée');

      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== RÉGULARISATION ====================
  static async regulariser(demandeId, userId) {
    try {


      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      const userRole = await this.getUserRole(userId);

      // Vérifier les permissions
      if (!['conseiller', 'rm', 'dce', 'adg', 'admin', 'risques'].includes(userRole)) {
        throw new Error('Vous n\'avez pas les droits pour régulariser');
      }

      // Seules les demandes validées peuvent être régularisées
      if (demande.statut !== STATUTS_DEMANDE.APPROUVEE) {
        throw new Error('Seules les demandes validées peuvent être régularisées');
      }

      // Déterminer le nouveau statut
      const nouveauStatut = WorkflowService.getNextStatus(
        ACTIONS_DEMANDE.REGULARISER,
        demande.statut,
        demande.montant,
        userRole,
        demande.notationClient,
        demande.agenceId
      );

      // Mettre à jour
      demande.statut = nouveauStatut;
      demande.regularisee = true;
      demande.dateRegularisation = new Date();
      demande.addHistoryEntry(ACTIONS_DEMANDE.REGULARISER, userId, 'Demande régularisée');

      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== MISE À JOUR ====================
  static async mettreAJourDemande(demandeId, updateData, userId) {
    try {


      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      // Vérifier les permissions
      const userRole = await this.getUserRole(userId);
      const isOwner = demande.clientId.toString() === userId.toString();

      if (!isOwner && userRole !== 'admin') {
        throw new Error('Seul le propriétaire ou un admin peut modifier');
      }

      // Vérifier que c'est un brouillon
      if (demande.statut !== STATUTS_DEMANDE.BROUILLON) {
        throw new Error('Seules les demandes brouillon peuvent être modifiées');
      }

      // Mettre à jour
      Object.assign(demande, updateData);
      demande.addHistoryEntry('MODIFICATION', userId, 'Demande modifiée');

      await demande.save();


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== STATISTIQUES ====================
  static async getStatistiques(filters = {}) {
    try {


      const match = {};

      // Appliquer les filtres
      if (filters.clientId) match.clientId = new mongoose.Types.ObjectId(filters.clientId);
      if (filters.agenceId) match.agenceId = filters.agenceId;
      if (filters.dateDebut) match.createdAt = { $gte: new Date(filters.dateDebut) };
      if (filters.dateFin) {
        match.createdAt = match.createdAt || {};
        match.createdAt.$lte = new Date(filters.dateFin);
      }

      // Agrégations principales
      const stats = await DemandeForçage.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalMontant: { $sum: '$montant' },
            montantMoyen: { $avg: '$montant' },
            enCours: {
              $sum: {
                $cond: [
                  {
                    $in: ['$statut', [
                      STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
                      STATUTS_DEMANDE.EN_ETUDE_CONSEILLER,
                      STATUTS_DEMANDE.EN_ATTENTE_RM,
                      STATUTS_DEMANDE.EN_ATTENTE_DCE,
                      STATUTS_DEMANDE.EN_ATTENTE_ADG,
                      STATUTS_DEMANDE.EN_ANALYSE_RISQUES
                    ]]
                  },
                  1, 0
                ]
              }
            },
            validees: {
              $sum: { $cond: [{ $in: ['$statut', [STATUTS_DEMANDE.APPROUVEE, STATUTS_DEMANDE.DECAISSEE]] }, 1, 0] }
            },
            regularisees: {
              $sum: { $cond: [{ $eq: ['$statut', STATUTS_DEMANDE.REGULARISEE] }, 1, 0] }
            },
            refusees: {
              $sum: { $cond: [{ $eq: ['$statut', STATUTS_DEMANDE.REJETEE] }, 1, 0] }
            },
            annulees: {
              $sum: { $cond: [{ $eq: ['$statut', STATUTS_DEMANDE.ANNULEE] }, 1, 0] }
            },
            enRetard: {
              $sum: { $cond: [{ $eq: ['$enRetard', true] }, 1, 0] }
            }
          }
        }
      ]);

      // Statistiques par statut
      const statsByStatus = await DemandeForçage.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$statut',
            count: { $sum: 1 },
            totalMontant: { $sum: '$montant' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Statistiques par agence
      const statsByAgence = await DemandeForçage.aggregate([
        { $match: { ...match, agenceId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$agenceId',
            count: { $sum: 1 },
            totalMontant: { $sum: '$montant' },
            enCours: {
              $sum: {
                $cond: [
                  {
                    $in: ['$statut', [
                      STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
                      STATUTS_DEMANDE.EN_ATTENTE_RM,
                      STATUTS_DEMANDE.EN_ATTENTE_DCE,
                      STATUTS_DEMANDE.EN_ATTENTE_ADG
                    ]]
                  },
                  1, 0
                ]
              }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Calculer les taux
      const baseStats = stats[0] || {
        total: 0,
        totalMontant: 0,
        montantMoyen: 0,
        enCours: 0,
        validees: 0,
        regularisees: 0,
        refusees: 0,
        annulees: 0,
        enRetard: 0
      };

      const result = {
        ...baseStats,
        parStatut: statsByStatus,
        parAgence: statsByAgence,
        tauxValidation: baseStats.total > 0 ? (baseStats.validees / baseStats.total) * 100 : 0,
        tauxRefus: baseStats.total > 0 ? (baseStats.refusees / baseStats.total) * 100 : 0,
        tauxRegularisation: baseStats.validees > 0 ? (baseStats.regularisees / baseStats.validees) * 100 : 0,
        tauxRetard: baseStats.enCours > 0 ? (baseStats.enRetard / baseStats.enCours) * 100 : 0
      };


      return result;

    } catch (error) {

      throw error;
    }
  }

  // ==================== ASSIGNATION AUTOMATIQUE ====================
  static async assignerConseillerAutomatique(demandeId) {
    try {


      const demande = await DemandeForçage.findById(demandeId);
      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      // Si déjà assigné, ne rien faire
      if (demande.conseillerId) {

        return demande;
      }

      // Trouver un conseiller disponible dans l'agence
      const conseiller = await User.findOne({
        role: 'conseiller',
        agence: demande.agenceId || 'Agence Centrale',
        isActive: true
      }).sort({ chargeTravail: 1 }); // Prendre le moins chargé

      if (!conseiller) {

        return demande;
      }

      // Assigner le conseiller
      demande.conseillerId = conseiller._id;
      await demande.save();

      // Mettre à jour la charge de travail du conseiller
      await User.findByIdAndUpdate(conseiller._id, {
        $inc: { chargeTravail: 1 }
      });


      return demande;

    } catch (error) {

      throw error;
    }
  }

  // ==================== VÉRIFICATION LIMITES ====================
  static async verifierLimiteAutorisation(userId, montant) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      const limite = LIMITES_AUTORISATION[user.role];

      if (limite === undefined) {
        throw new Error('Limite non définie pour votre rôle');
      }

      if (limite !== Infinity && montant > limite) {
        throw new Error(`Montant (${montant}) dépasse votre limite d'autorisation (${limite})`);
      }

      return true;

    } catch (error) {

      throw error;
    }
  }

  // ==================== FONCTIONS UTILITAIRES ====================

  // Obtenir le rôle d'un utilisateur
  static async getUserRole(userId) {
    try {
      const user = await User.findById(userId).select('role');
      return user ? user.role : null;
    } catch (error) {

      return null;
    }
  }

  // Obtenir les actions disponibles pour un rôle
  static getWorkflowDisponible(userRole, currentStatus = null) {
    // Cette méthode est maintenue pour compatibilité
    // Utilisez plutôt WorkflowService.getAvailableActions()
    if (currentStatus) {
      return WorkflowService.getAvailableActions(
        currentStatus,
        userRole,
        null, // Pas de montant
        'C'   // Notation par défaut
      );
    }

    // Toutes les actions possibles pour ce rôle
    const actions = [];

    switch (userRole) {
      case 'client':
        actions.push(ACTIONS_DEMANDE.SOUMETTRE, ACTIONS_DEMANDE.ANNULER);
        break;
      case 'conseiller':
        actions.push(ACTIONS_DEMANDE.VALIDER, ACTIONS_DEMANDE.REJETER, ACTIONS_DEMANDE.REMONTER, ACTIONS_DEMANDE.RETOURNER);
        break;
      case 'rm':
      case 'dce':
      case 'adg':
        actions.push(ACTIONS_DEMANDE.VALIDER, ACTIONS_DEMANDE.REJETER, ACTIONS_DEMANDE.REMONTER, ACTIONS_DEMANDE.RETOURNER);
        break;
      case 'risques':
        actions.push(ACTIONS_DEMANDE.VALIDER, ACTIONS_DEMANDE.REJETER);
        break;
      case 'admin':
      case 'dga':
        actions.push(...Object.values(ACTIONS_DEMANDE));
        break;
    }

    return actions;
  }

  // Calculer le score de risque
  static calculerScoreRisque(client, montant, montantForçageTotal) {
    return WorkflowService.calculateRiskLevel(montant, client.notationClient || 'C');
  }

  // Trouver les demandes en retard
  static async getDemandesEnRetard() {
    return DemandeForçage.findEnRetard();
  }

  // Statistiques par période
  static async getStatsByPeriod(startDate, endDate, agenceId = null) {
    return DemandeForçage.getStatsByPeriod(startDate, endDate, agenceId);
  }

  // Mettre à jour les retards
  static async updateRetards() {
    try {
      const demandes = await DemandeForçage.find({
        dateEcheance: { $lt: new Date() },
        statut: {
          $nin: [STATUTS_DEMANDE.REGULARISEE, STATUTS_DEMANDE.REJETEE, STATUTS_DEMANDE.ANNULEE]
        },
        enRetard: false
      });

      for (const demande of demandes) {
        demande.enRetard = true;
        await demande.save();


      }


      return demandes.length;

    } catch (error) {

      return 0;
    }
  }
}

module.exports = DemandeForçageService;