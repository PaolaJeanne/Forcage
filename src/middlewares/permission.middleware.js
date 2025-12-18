// src/middlewares/permission.middleware.js
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
 * Middleware pour vérifier la limite d'autorisation
 */
const requireAuthorizationLimit = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 401, 'Non authentifié');
  }
  
  const montant = req.body.montant || req.body.montantAutorise;
  
  if (!montant) {
    return errorResponse(res, 400, 'Montant requis');
  }
  
  if (!PermissionHelper.canAuthorizeMontant(req.user.role, montant)) {
    const limite = require('../constants/roles').LIMITES_AUTORISATION[req.user.role];
    return errorResponse(
      res, 
      403, 
      `Montant (${montant} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }
  
  next();
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAuthorizationLimit
};