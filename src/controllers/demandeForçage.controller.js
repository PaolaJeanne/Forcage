// ============================================
// CONTROLLER DEMANDE FORÇAGE COMPLET - src/controllers/demandeForçage.controller.js
// ============================================
const DemandeForçageService = require('../services/demandeForcage.service');
const { validationResult } = require('express-validator');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');
const User = require('../models/User');

// ==================== CRÉATION ====================
exports.creerDemande = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, 'Données invalides', errors.array());
    }

    // Vérifier que l'utilisateur est un client
    if (req.user.role !== 'client') {
      return errorResponse(res, 403, 'Seuls les clients peuvent créer des demandes');
    }

    // Récupérer les infos client
    const client = await User.findById(req.user.id);
    
    // Calculer le montant de forçage (si solde disponible)
    const soldeActuel = client.soldeActuel || 0;
    const decouvertAutorise = client.decouvertAutorise || 0;
    const montant = req.body.montant;
    const montantForçageTotal = Math.max(0, montant - (soldeActuel + decouvertAutorise));

    // Construire les données de la demande
    const demandeData = {
      ...req.body,
      compteNumero: client.numeroCompte,
      agenceId: client.agence,
      notationClient: client.notationClient,
      classification: client.classification,
      soldeActuel,
      decouvertAutorise,
      montantForçageTotal,
      scoreRisque: this.calculerScoreRisque(client, montant, montantForçageTotal)
    };

    const demande = await DemandeForçageService.creerDemande(req.user.id, demandeData);

    logger.info(`Demande créée: ${demande.numeroReference} par ${req.user.email}`);

    // RÉPONSE OPTIMISÉE
    return successResponse(res, 201, 'Demande créée avec succès', {
      demande: {
        id: demande._id,
        numeroReference: demande.numeroReference,
        statut: demande.statut,
        montant: demande.montant,
        typeOperation: demande.typeOperation,
        scoreRisque: demande.scoreRisque,
        dateEcheance: demande.dateEcheance,
        createdAt: demande.createdAt
      }
    });
  } catch (error) {
    logger.error('Erreur création demande:', error);
    return errorResponse(res, 500, 'Erreur lors de la création', error.message);
  }
};

// ==================== LISTAGE ====================
exports.listerDemandes = async (req, res) => {
  try {
    const filters = this.construireFiltres(req);
    const options = this.construireOptions(req);

    const result = await DemandeForçageService.listerDemandes(filters, options);

    // Adapter la réponse selon le rôle
    const demandesAdaptees = this.adapterReponseDemandes(result.demandes, req.user.role);

    return successResponse(res, 200, 'Liste des demandes récupérée', {
      demandes: demandesAdaptees,
      pagination: result.pagination,
      workflowDisponible: DemandeForçageService.getWorkflowDisponible(req.user.role, null)
    });
  } catch (error) {
    logger.error('Erreur listage demandes:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};

// ==================== CONSULTATION ====================
exports.getDemande = async (req, res) => {
  try {
    const demande = await DemandeForçageService.getDemandeById(req.params.id);

    // Vérifier les permissions
    if (!this.verifierPermissionDemande(demande, req.user)) {
      return errorResponse(res, 403, 'Accès non autorisé à cette demande');
    }

    // Formater la réponse selon le rôle
    const reponseFormatee = this.formaterReponseDemande(demande, req.user);

    // Ajouter les actions disponibles
    reponseFormatee.actionsDisponibles = DemandeForçageService.getWorkflowDisponible(
      req.user.role, 
      demande.statut
    );

    return successResponse(res, 200, 'Détails de la demande', {
      demande: reponseFormatee
    });
  } catch (error) {
    logger.error('Erreur consultation demande:', error);
    return errorResponse(res, 404, error.message);
  }
};

// ==================== SOUMISSION ====================
exports.soumettreDemande = async (req, res) => {
  try {
    // Vérifier que c'est bien le propriétaire
    const demande = await DemandeForçageService.getDemandeById(req.params.id);
    
    if (demande.clientId._id.toString() !== req.user.id) {
      return errorResponse(res, 403, 'Seul le propriétaire peut soumettre la demande');
    }

    const demandeSoumise = await DemandeForçageService.soumettreDemande(req.params.id, req.user.id);

    // Assigner automatiquement un conseiller
    await DemandeForçageService.assignerConseillerAutomatique(req.params.id);

    logger.info(`Demande soumise: ${demandeSoumise.numeroReference} par ${req.user.email}`);

    return successResponse(res, 200, 'Demande soumise avec succès', {
      demande: {
        id: demandeSoumise._id,
        numeroReference: demandeSoumise.numeroReference,
        statut: demandeSoumise.statut,
        updatedAt: demandeSoumise.updatedAt,
        conseiller: demandeSoumise.conseillerId
      }
    });
  } catch (error) {
    logger.error('Erreur soumission demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// ==================== ANNULATION ====================
exports.annulerDemande = async (req, res) => {
  try {
    const demande = await DemandeForçageService.getDemandeById(req.params.id);
    
    // Seul le client peut annuler, sauf admin en cas exceptionnel
    if (demande.clientId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Seul le client peut annuler sa demande');
    }

    const demandeAnnulee = await DemandeForçageService.annulerDemande(req.params.id, req.user.id);

    logger.info(`Demande annulée: ${demandeAnnulee.numeroReference} par ${req.user.email}`);

    return successResponse(res, 200, 'Demande annulée avec succès', {
      demande: {
        id: demandeAnnulee._id,
        numeroReference: demandeAnnulee.numeroReference,
        statut: demandeAnnulee.statut,
        updatedAt: demandeAnnulee.updatedAt
      }
    });
  } catch (error) {
    logger.error('Erreur annulation demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// ==================== TRAITEMENT ====================
exports.traiterDemande = async (req, res) => {
  try {
    const { action, commentaire, montantAutorise, conditionsParticulieres } = req.body;

    if (!action) {
      return errorResponse(res, 400, 'Action requise');
    }

    // Vérifier que l'action est disponible pour ce rôle et ce statut
    const demande = await DemandeForçageService.getDemandeById(req.params.id);
    const actionsDisponibles = DemandeForçageService.getWorkflowDisponible(req.user.role, demande.statut);
    
    if (!actionsDisponibles.includes(action)) {
      return errorResponse(res, 403, `Action "${action}" non autorisée pour votre rôle`);
    }

    // Vérifier les limites d'autorisation pour la validation
    if (action === 'VALIDER') {
      const montant = montantAutorise || demande.montant;
      await DemandeForçageService.verifierLimiteAutorisation(req.user.id, montant);
    }

    // Traiter la demande
    const demandeTraitee = await DemandeForçageService.traiterDemande(
      req.params.id,
      req.user.id,
      action,
      { 
        commentaire, 
        montantAutorise: montantAutorise || demande.montant,
        conditionsParticulieres 
      }
    );

    logger.info(`Demande traitée: ${demandeTraitee.numeroReference} - ${action} par ${req.user.email}`);

    return successResponse(res, 200, `Demande ${this.getLabelAction(action)} avec succès`, {
      demande: {
        id: demandeTraitee._id,
        numeroReference: demandeTraitee.numeroReference,
        statut: demandeTraitee.statut,
        montantAutorise: demandeTraitee.montantAutorise,
        dateEcheance: demandeTraitee.dateEcheance,
        updatedAt: demandeTraitee.updatedAt,
        conseiller: demandeTraitee.conseillerId,
        actionsDisponibles: DemandeForçageService.getWorkflowDisponible(req.user.role, demandeTraitee.statut)
      }
    });
  } catch (error) {
    logger.error('Erreur traitement demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// ==================== REMONTÉE HIÉRARCHIQUE ====================
exports.remonterDemande = async (req, res) => {
  try {
    const { commentaire } = req.body;

    // Vérifier que l'utilisateur peut remonter
    const demande = await DemandeForçageService.getDemandeById(req.params.id);
    const actionsDisponibles = DemandeForçageService.getWorkflowDisponible(req.user.role, demande.statut);
    
    if (!actionsDisponibles.includes('REMONTER')) {
      return errorResponse(res, 403, 'Vous ne pouvez pas remonter cette demande');
    }

    const demandeRemontee = await DemandeForçageService.remonterDemande(
      req.params.id,
      req.user.id,
      commentaire
    );

    logger.info(`Demande remontée: ${demandeRemontee.numeroReference} par ${req.user.email}`);

    return successResponse(res, 200, 'Demande remontée au niveau supérieur', {
      demande: {
        id: demandeRemontee._id,
        numeroReference: demandeRemontee.numeroReference,
        statut: demandeRemontee.statut,
        updatedAt: demandeRemontee.updatedAt
      }
    });
  } catch (error) {
    logger.error('Erreur remontée demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// ==================== RÉGULARISATION ====================
exports.regulariser = async (req, res) => {
  try {
    const demande = await DemandeForçageService.getDemandeById(req.params.id);

    // Seules les demandes validées peuvent être régularisées
    if (demande.statut !== 'VALIDEE') {
      return errorResponse(res, 400, 'Seules les demandes validées peuvent être régularisées');
    }

    // Vérifier les permissions (conseiller, responsable ou admin)
    if (!['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
      return errorResponse(res, 403, 'Vous n\'avez pas les droits pour régulariser');
    }

    const demandeRegularisee = await DemandeForçageService.regulariser(req.params.id, req.user.id);

    logger.info(`Demande régularisée: ${demandeRegularisee.numeroReference} par ${req.user.email}`);

    return successResponse(res, 200, 'Demande régularisée avec succès', {
      demande: {
        id: demandeRegularisee._id,
        numeroReference: demandeRegularisee.numeroReference,
        regularisee: demandeRegularisee.regularisee,
        dateRegularisation: demandeRegularisee.dateRegularisation,
        updatedAt: demandeRegularisee.updatedAt
      }
    });
  } catch (error) {
    logger.error('Erreur régularisation:', error);
    return errorResponse(res, 400, error.message);
  }
};

// ==================== STATISTIQUES ====================
exports.getStatistiques = async (req, res) => {
  try {
    const filters = this.construireFiltresStatistiques(req);
    
    const stats = await DemandeForçageService.getStatistiques(filters);

    // Enrichir avec des statistiques par rôle
    const statsEnrichies = await this.enrichirStatistiques(stats, req.user);

    return successResponse(res, 200, 'Statistiques récupérées', {
      statistiques: statsEnrichies,
      periode: {
        dateDebut: filters.dateDebut,
        dateFin: filters.dateFin
      }
    });
  } catch (error) {
    logger.error('Erreur statistiques:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};

// ==================== MISE À JOUR ====================
exports.mettreAJourDemande = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, 'Données invalides', errors.array());
    }

    // Vérifier les permissions
    const demande = await DemandeForçageService.getDemandeById(req.params.id);
    
    if (demande.clientId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Seul le propriétaire ou un admin peut modifier');
    }

    if (demande.statut !== 'BROUILLON') {
      return errorResponse(res, 400, 'Seules les demandes brouillon peuvent être modifiées');
    }

    // Mettre à jour
    const demandeMaj = await DemandeForçage.updateOne(
      { _id: req.params.id },
      { $set: req.body },
      { new: true }
    ).populate('clientId', 'nom prenom email');

    logger.info(`Demande mise à jour: ${demandeMaj.numeroReference} par ${req.user.email}`);

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
    logger.error('Erreur mise à jour demande:', error);
    return errorResponse(res, 500, 'Erreur lors de la mise à jour', error.message);
  }
};

// ==================== FONCTIONS UTILITAIRES ====================

// Calculer le score de risque
exports.calculerScoreRisque = (client, montant, montantForçageTotal) => {
  let score = 0;
  
  // Notation client
  const notations = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
  score += notations[client.notationClient] || 3;
  
  // Pourcentage de forçage
  const pourcentageForçage = (montantForçageTotal / montant) * 100;
  if (pourcentageForçage > 50) score += 2;
  else if (pourcentageForçage > 25) score += 1;
  
  // Classification
  if (client.classification === 'sensible') score += 2;
  if (client.classification === 'restructure') score += 3;
  if (client.classification === 'defaut') score += 4;
  
  // Déterminer le niveau
  if (score >= 8) return 'CRITIQUE';
  if (score >= 6) return 'ELEVE';
  if (score >= 4) return 'MOYEN';
  return 'FAIBLE';
};

// Construire les filtres selon le rôle
exports.construireFiltres = (req) => {
  const filters = {
    statut: req.query.statut,
    scoreRisque: req.query.scoreRisque,
    typeOperation: req.query.typeOperation,
    agenceId: req.query.agenceId
  };

  // Filtres spécifiques par rôle
  switch (req.user.role) {
    case 'client':
      filters.clientId = req.user.id;
      break;
      
    case 'conseiller':
      filters.conseillerId = req.user.id;
      break;
      
    case 'rm':
    case 'dce':
      filters.agenceId = req.user.agence;
      break;
      
    case 'admin':
    case 'dga':
    case 'adg':
    case 'risques':
      // Voir toutes les demandes
      break;
  }

  // Filtres dates
  if (req.query.dateDebut) {
    filters.createdAt = { $gte: new Date(req.query.dateDebut) };
  }
  if (req.query.dateFin) {
    filters.createdAt = { ...filters.createdAt, $lte: new Date(req.query.dateFin) };
  }

  return filters;
};

// Construire les options de pagination/tri
exports.construireOptions = (req) => ({
  page: parseInt(req.query.page) || 1,
  limit: parseInt(req.query.limit) || 20,
  sort: req.query.sort || '-createdAt'
});

// Adapter la réponse des demandes selon le rôle
exports.adapterReponseDemandes = (demandes, role) => {
  return demandes.map(demande => {
    const base = {
      id: demande._id,
      numeroReference: demande.numeroReference,
      statut: demande.statut,
      montant: demande.montant,
      typeOperation: demande.typeOperation,
      scoreRisque: demande.scoreRisque,
      createdAt: demande.createdAt,
      enRetard: demande.enRetard
    };

    // Infos supplémentaires selon le rôle
    if (role !== 'client') {
      base.client = demande.clientId ? {
        nom: demande.clientId.nom,
        prenom: demande.clientId.prenom,
        agence: demande.agenceId
      } : null;
      
      if (['conseiller', 'rm', 'dce', 'admin', 'dga', 'adg', 'risques'].includes(role)) {
        base.conseiller = demande.conseillerId;
        base.priorite = demande.priorite;
      }
    }

    return base;
  });
};

// Vérifier les permissions sur une demande
exports.verifierPermissionDemande = (demande, user) => {
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
  
  return false;
};

// Formater la réponse détaillée selon le rôle
exports.formaterReponseDemande = (demande, user) => {
  const base = {
    id: demande._id,
    numeroReference: demande.numeroReference,
    statut: demande.statut,
    montant: demande.montant,
    typeOperation: demande.typeOperation,
    motif: demande.motif,
    scoreRisque: demande.scoreRisque,
    priorite: demande.priorite,
    createdAt: demande.createdAt,
    enRetard: demande.enRetard
  };

  // Infos client (toujours visibles)
  base.client = {
    id: demande.clientId._id,
    nom: demande.clientId.nom,
    prenom: demande.clientId.prenom
  };

  // Infos supplémentaires selon le rôle
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
};

// Construire les filtres pour les statistiques
exports.construireFiltresStatistiques = (req) => {
  const filters = {};
  
  if (req.user.role === 'client') {
    filters.clientId = req.user.id;
  }
  
  if (req.query.dateDebut) filters.dateDebut = req.query.dateDebut;
  if (req.query.agenceId && ['admin', 'dga', 'adg', 'risques'].includes(req.user.role)) {
    filters.agenceId = req.query.agenceId;
  }
  
  return filters;
};

// Enrichir les statistiques
exports.enrichirStatistiques = async (stats, user) => {
  const enrichies = { ...stats };
  
  if (['admin', 'dga', 'adg', 'risques'].includes(user.role)) {
    // Récupérer les stats par agence
    const statsAgence = await DemandeForçage.aggregate([
      { $group: {
        _id: '$agenceId',
        total: { $sum: 1 },
        montantTotal: { $sum: '$montant' }
      }}
    ]);
    
    enrichies.parAgence = statsAgence;
    
    // Taux de validation
    if (stats.total > 0) {
      enrichies.tauxValidation = (stats.validees / stats.total) * 100;
      enrichies.tauxRefus = (stats.refusees / stats.total) * 100;
    }
  }
  
  return enrichies;
};

// Obtenir le label d'une action
exports.getLabelAction = (action) => {
  const labels = {
    'PRENDRE_EN_CHARGE': 'prise en charge',
    'VALIDER': 'validée',
    'REFUSER': 'refusée',
    'DEMANDER_INFO': 'en attente d\'informations',
    'REMONTER': 'remontée',
    'REGULARISER': 'régularisée'
  };
  return labels[action] || action.toLowerCase();
};