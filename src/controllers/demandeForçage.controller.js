const demandeService = require('../services/demandeForcage.service');
const { validationResult } = require('express-validator');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');

// Créer une demande
exports.creerDemande = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, 'Données invalides', errors.array());
    }

    const demande = await demandeService.creerDemande(req.userId, req.body);

    logger.info(`Demande créée: ${demande.numeroReference} par user ${req.userId}`);

    return successResponse(res, 201, 'Demande créée avec succès', { demande });
  } catch (error) {
    logger.error('Erreur création demande:', error);
    return errorResponse(res, 500, 'Erreur lors de la création', error.message);
  }
};

// Lister les demandes
exports.listerDemandes = async (req, res) => {
  try {
    const filters = {
      statut: req.query.statut,
      scoreRisque: req.query.scoreRisque
    };

    if (req.userRole === 'client') filters.clientId = req.userId;
    if (req.userRole === 'conseiller') filters.conseillerId = req.userId;

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sort: req.query.sort || '-createdAt'
    };

    const result = await demandeService.listerDemandes(filters, options);

    return successResponse(res, 200, 'Liste des demandes', {
      demandes: result.demandes,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Erreur listing demandes:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};

// Obtenir une demande
exports.getDemande = async (req, res) => {
  try {
    const demande = await demandeService.getDemandeById(req.params.id, req.userId);

    if (req.userRole === 'client' && demande.clientId._id.toString() !== req.userId) {
      return errorResponse(res, 403, 'Accès non autorisé');
    }

    return successResponse(res, 200, 'Détails de la demande', { demande });
  } catch (error) {
    logger.error('Erreur get demande:', error);
    return errorResponse(res, 404, error.message);
  }
};

// Soumettre une demande
exports.soumettreDemande = async (req, res) => {
  try {
    const demande = await demandeService.soumettreDemande(req.params.id, req.userId);

    logger.info(`Demande soumise: ${demande.numeroReference}`);

    return successResponse(res, 200, 'Demande soumise avec succès', { demande });
  } catch (error) {
    logger.error('Erreur soumission demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// Annuler une demande
exports.annulerDemande = async (req, res) => {
  try {
    const demande = await demandeService.annulerDemande(req.params.id, req.userId);

    logger.info(`Demande annulée: ${demande.numeroReference}`);

    return successResponse(res, 200, 'Demande annulée', { demande });
  } catch (error) {
    logger.error('Erreur annulation demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// Traiter une demande
exports.traiterDemande = async (req, res) => {
  try {
    const { action } = req.body;

    if (!action) return errorResponse(res, 400, 'Action requise');

    const demande = await demandeService.traiterDemande(
      req.params.id,
      req.userId,
      action,
      req.body
    );

    logger.info(`Demande traitée: ${demande.numeroReference} - Action: ${action}`);

    return successResponse(res, 200, 'Demande traitée avec succès', { demande });
  } catch (error) {
    logger.error('Erreur traitement demande:', error);
    return errorResponse(res, 400, error.message);
  }
};

// Régulariser
exports.regulariser = async (req, res) => {
  try {
    const demande = await demandeService.regulariser(req.params.id, req.userId);

    logger.info(`Demande régularisée: ${demande.numeroReference}`);

    return successResponse(res, 200, 'Demande régularisée', { demande });
  } catch (error) {
    logger.error('Erreur régularisation:', error);
    return errorResponse(res, 400, error.message);
  }
};

// Statistiques
exports.getStatistiques = async (req, res) => {
  try {
    const filters = {};

    if (req.userRole === 'client') filters.clientId = req.userId;

    const stats = await demandeService.getStatistiques(filters);

    return successResponse(res, 200, 'Statistiques', { stats });
  } catch (error) {
    logger.error('Erreur stats:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};
// Mettre à jour une demande (optionnel)
exports.mettreAJourDemande = async (req, res) => {
  try { 
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 400, 'Données invalides', errors.array());
    }
    const demande = await demandeService.mettreAJourDemande(req.params.id, req.userId, req.body);

    logger.info(`Demande mise à jour: ${demande.numeroReference} par user ${req.userId}`);
    return successResponse(res, 200, 'Demande mise à jour avec succès', { demande });
  } catch (error) {
    logger.error('Erreur mise à jour demande:', error);
    return errorResponse(res, 500, 'Erreur lors de la mise à jour', error.message);
  }
};