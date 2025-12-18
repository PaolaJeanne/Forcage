// src/middlewares/permission.middleware.js - VERSION CORRIGÉE
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
  console.log('\n💰 ===== REQUIRE AUTHORIZATION LIMIT =====');
  console.log('📍 URL:', req.url);
  console.log('📝 Méthode:', req.method);
  console.log('📦 Body:', req.body);
  console.log('👤 User:', req.user?.email);
  console.log('🎭 Role:', req.user?.role);
  
  if (!req.user) {
    console.log('❌ Utilisateur non authentifié');
    return errorResponse(res, 401, 'Non authentifié');
  }
  
  // Actions qui nécessitent un montant
  const actionsRequiringAmount = ['AUTORISER', 'APPROUVER', 'ACCORDER', 'AUTHORIZE', 'APPROVE', 'GRANT'];
  
  // Actions qui ne nécessitent PAS de montant
  const actionsWithoutAmount = ['VALIDER', 'REJETER', 'RETOURNER', 'ANNULER', 'ETUDIER', 'VALIDATE', 'REJECT', 'RETURN', 'CANCEL', 'STUDY'];
  
  const { action } = req.body;
  
  // Si pas d'action spécifiée
  if (!action) {
    console.log('⚠️ Pas d\'action spécifiée');
    const montant = req.body.montant || req.body.montantAutorise;
    
    if (montant) {
      console.log('💰 Montant trouvé:', montant);
      return checkMontant(req, res, next, montant);
    } else {
      console.log('✅ Pas de montant, passage autorisé');
      return next();
    }
  }
  
  // Normaliser l'action
  const normalizedAction = action.toUpperCase();
  console.log(`🔍 Action: "${normalizedAction}"`);
  
  // Si action sans montant
  if (actionsWithoutAmount.includes(normalizedAction)) {
    console.log(`✅ Action "${normalizedAction}" ne nécessite pas de montant`);
    return next();
  }
  
  // Si action avec montant
  if (actionsRequiringAmount.includes(normalizedAction)) {
    console.log(`🔍 Action "${normalizedAction}" nécessite un montant`);
    const montant = req.body.montant || req.body.montantAutorise;
    
    if (!montant) {
      console.log(`❌ Montant requis pour "${normalizedAction}"`);
      return errorResponse(res, 400, `Montant requis pour l'action "${action}"`);
    }
    
    return checkMontant(req, res, next, montant);
  }
  
  // Action non reconnue
  console.log(`⚠️ Action "${normalizedAction}" non reconnue`);
  const montant = req.body.montant || req.body.montantAutorise;
  
  if (montant) {
    console.log('💰 Montant trouvé, vérification');
    return checkMontant(req, res, next, montant);
  }
  
  console.log('✅ Pas de montant, passage autorisé');
  next();
};

// Fonction helper pour vérifier le montant
function checkMontant(req, res, next, montant) {
  console.log('🔍 Vérification montant:', montant);
  
  if (!PermissionHelper.canAuthorizeMontant(req.user.role, montant)) {
    // Récupérer la limite depuis roles constants
    const rolesConstants = require('../constants/roles');
    const limite = rolesConstants.LIMITES_AUTORISATION[req.user.role] || 0;
    
    console.log(`❌ Limite dépassée: ${montant} > ${limite}`);
    return errorResponse(
      res, 
      403, 
      `Montant (${montant} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }
  
  console.log('✅ Montant dans les limites');
  next();
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAuthorizationLimit
};