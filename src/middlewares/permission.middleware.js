// src/middlewares/permission.middleware.js - VERSION COMPLÈTE CORRIGÉE
const PermissionHelper = require('../helpers/permission.helper');
const { errorResponse } = require('../utils/response.util');

/**
 * Middleware pour vérifier une permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {


    if (!req.user) {

      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasPermission(req.user.role, permission)) {

      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir la permission: ${permission}`
      );
    }



    next();
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (OU)
 */
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {


    if (!req.user) {

      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasAnyPermission(req.user.role, permissions)) {

      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir l'une de ces permissions: ${permissions.join(', ')}`
      );
    }



    next();
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (ET)
 */
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {


    if (!req.user) {

      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasAllPermissions(req.user.role, permissions)) {

      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir toutes ces permissions: ${permissions.join(', ')}`
      );
    }



    next();
  };
};

/**
 * Middleware pour vérifier la limite d'autorisation - VERSION CORRIGÉE
 */
const requireAuthorizationLimit = (req, res, next) => {


  if (!req.user) {

    return errorResponse(res, 401, 'Non authentifié');
  }



  // Actions qui nécessitent un montant (opérations financières)
  const actionsRequiringAmount = [
    'AUTORISER', 'APPROUVER', 'ACCORDER',
    'AUTHORIZE', 'APPROVE', 'GRANT'
  ];

  // Actions qui ne nécessitent PAS de montant (actions de workflow)
  const actionsWithoutAmount = [
    'VALIDER', 'REJETER', 'RETOURNER', 'ANNULER', 'ETUDIER',
    'VALIDATE', 'REJECT', 'RETURN', 'CANCEL', 'STUDY'
  ];

  const { action } = req.body;

  // Si pas d'action spécifiée
  if (!action) {


    // Vérifier s'il y a un montant sans action
    const montant = req.body.montant || req.body.montantAutorise;

    if (montant !== undefined && montant !== null) {

      return checkMontant(req, res, next, montant);
    }


    return next();
  }

  // Normaliser l'action
  const normalizedAction = action.toUpperCase().trim();


  // Si c'est une action qui ne nécessite PAS de montant
  if (actionsWithoutAmount.includes(normalizedAction)) {

    return next();
  }

  // Si c'est une action qui nécessite un montant
  if (actionsRequiringAmount.includes(normalizedAction)) {


    const montant = req.body.montant || req.body.montantAutorise;

    if (montant === undefined || montant === null) {

      return errorResponse(res, 400, `Montant requis pour l'action "${action}"`);
    }


    return checkMontant(req, res, next, montant);
  }

  // Action non reconnue


  // Pour les actions non reconnues, vérifier s'il y a un montant
  const montant = req.body.montant || req.body.montantAutorise;

  if (montant !== undefined && montant !== null) {

    return checkMontant(req, res, next, montant);
  }


  return next();
};

// Fonction helper pour vérifier le montant
function checkMontant(req, res, next, montant) {


  // Valider que le montant est un nombre
  if (isNaN(montant) || montant < 0) {

    return errorResponse(res, 400, 'Montant invalide');
  }

  // Convertir en nombre
  const montantNum = Number(montant);

  // Si montant = 0, c'est toujours OK
  if (montantNum === 0) {

    return next();
  }

  // Utiliser PermissionHelper pour vérifier la limite
  if (!PermissionHelper.canAuthorizeMontant(req.user.role, montantNum)) {
    const { LIMITES_AUTORISATION } = require('../constants/roles');
    const limite = LIMITES_AUTORISATION[req.user.role] || 0;


    return errorResponse(
      res,
      403,
      `Montant (${montantNum} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }


  return next();
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAuthorizationLimit
};