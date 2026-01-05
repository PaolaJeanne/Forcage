// src/middlewares/role.middleware.js
const { errorResponse } = require('../utils/response.util');
const PermissionHelper = require('../helpers/permission.helper');

exports.authorize = (roles = []) => (req, res, next) => {
  console.log('🔐 [ROLE_MIDDLEWARE] Vérification rôles:', roles);
  console.log('👤 Utilisateur:', req.user?.email, 'Rôle:', req.userRole);
  
  if (!req.userRole) {
    console.error('❌ [ROLE_MIDDLEWARE] Rôle non défini');
    return errorResponse(res, 401, 'Non authentifié');
  }

  if (roles.length && !roles.includes(req.userRole)) {
    console.error('❌ [ROLE_MIDDLEWARE] Rôle non autorisé');
    console.log('📋 Rôle actuel:', req.userRole);
    console.log('📋 Rôles autorisés:', roles);
    return errorResponse(res, 403, `Accès non autorisé. Rôles autorisés: ${roles.join(', ')}`);
  }

  console.log('✅ [ROLE_MIDDLEWARE] Rôle autorisé');
  next();
};

// Ajouter checkRole comme alias de authorize
exports.checkRole = exports.authorize;

/**
 * Vérifier si l'utilisateur peut valider selon le montant
 */
exports.canValidateByAmount = (req, res, next) => {
  console.log('💰 [CAN_VALIDATE_BY_AMOUNT] Vérification validation par montant');
  
  const montant = req.body.montant || req.body.montantAutorise || 0;
  const montantNum = Number(montant);
  
  if (!PermissionHelper.canAuthorizeMontant(req.userRole, montantNum)) {
    const { LIMITES_AUTORISATION } = require('../constants/roles');
    const limite = LIMITES_AUTORISATION[req.userRole] || 0;
    
    console.error('❌ [CAN_VALIDATE_BY_AMOUNT] Limite dépassée');
    console.log('📋 Montant:', montantNum);
    console.log('📋 Limite:', limite);
    
    return errorResponse(
      res,
      403,
      `Montant (${montantNum} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }
  
  console.log('✅ [CAN_VALIDATE_BY_AMOUNT] Limite respectée');
  next();
};

/**
 * Vérifier l'accès hiérarchique
 */
exports.requireHierarchicalAccess = (requiredLevel) => {
  return (req, res, next) => {
    console.log('📊 [REQUIRE_HIERARCHICAL_ACCESS] Niveau requis:', requiredLevel);
    
    const userLevel = PermissionHelper.getHierarchyLevel(req.userRole);
    const requiredLevelIndex = PermissionHelper.getHierarchyLevel(requiredLevel);
    
    console.log('📊 Niveau utilisateur:', userLevel, '(', req.userRole, ')');
    console.log('📊 Niveau requis:', requiredLevelIndex, '(', requiredLevel, ')');
    
    if (userLevel < requiredLevelIndex) {
      console.error('❌ [REQUIRE_HIERARCHICAL_ACCESS] Niveau insuffisant');
      return errorResponse(
        res,
        403,
        `Niveau hiérarchique insuffisant. Requis: ${requiredLevel}`
      );
    }
    
    console.log('✅ [REQUIRE_HIERARCHICAL_ACCESS] Niveau suffisant');
    next();
  };
};