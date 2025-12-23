// src/middlewares/permission.middleware.js - VERSION COMPLÈTE CORRIGÉE
const PermissionHelper = require('../helpers/permission.helper');
const { errorResponse } = require('../utils/response.util');

/**
 * Middleware pour vérifier une permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    console.log('\n🔐 ===== REQUIRE PERMISSION =====');
    console.log('📍 Permission:', permission);
    console.log('👤 User:', req.user?.email);
    console.log('🎭 Role:', req.user?.role);
    
    if (!req.user) {
      console.log('❌ Utilisateur non authentifié');
      return errorResponse(res, 401, 'Non authentifié');
    }
    
    if (!PermissionHelper.hasPermission(req.user.role, permission)) {
      console.log(`❌ Permission "${permission}" refusée pour ${req.user.role}`);
      return errorResponse(
        res, 
        403, 
        `Permission refusée. Vous devez avoir la permission: ${permission}`
      );
    }
    
    console.log(`✅ Permission "${permission}" accordée`);
    console.log('🔐 ===== REQUIRE PERMISSION FIN =====\n');
    next();
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (OU)
 */
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    console.log('\n🔐 ===== REQUIRE ANY PERMISSION =====');
    console.log('📍 Permissions:', permissions);
    console.log('👤 User:', req.user?.email);
    
    if (!req.user) {
      console.log('❌ Utilisateur non authentifié');
      return errorResponse(res, 401, 'Non authentifié');
    }
    
    if (!PermissionHelper.hasAnyPermission(req.user.role, permissions)) {
      console.log(`❌ Aucune permission accordée parmi: ${permissions.join(', ')}`);
      return errorResponse(
        res, 
        403, 
        `Permission refusée. Vous devez avoir l'une de ces permissions: ${permissions.join(', ')}`
      );
    }
    
    console.log(`✅ Au moins une permission accordée parmi: ${permissions.join(', ')}`);
    console.log('🔐 ===== REQUIRE ANY PERMISSION FIN =====\n');
    next();
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (ET)
 */
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    console.log('\n🔐 ===== REQUIRE ALL PERMISSIONS =====');
    console.log('📍 Permissions:', permissions);
    console.log('👤 User:', req.user?.email);
    
    if (!req.user) {
      console.log('❌ Utilisateur non authentifié');
      return errorResponse(res, 401, 'Non authentifié');
    }
    
    if (!PermissionHelper.hasAllPermissions(req.user.role, permissions)) {
      console.log(`❌ Pas toutes les permissions: ${permissions.join(', ')}`);
      return errorResponse(
        res, 
        403, 
        `Permission refusée. Vous devez avoir toutes ces permissions: ${permissions.join(', ')}`
      );
    }
    
    console.log(`✅ Toutes les permissions accordées: ${permissions.join(', ')}`);
    console.log('🔐 ===== REQUIRE ALL PERMISSIONS FIN =====\n');
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
  
  if (!req.user) {
    console.log('❌ Utilisateur non authentifié');
    return errorResponse(res, 401, 'Non authentifié');
  }
  
  console.log('👤 User:', req.user.email);
  console.log('🎭 Role:', req.user.role);
  
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
    console.log('⚠️ Pas d\'action spécifiée');
    
    // Vérifier s'il y a un montant sans action
    const montant = req.body.montant || req.body.montantAutorise;
    
    if (montant !== undefined && montant !== null) {
      console.log(`💰 Montant trouvé sans action: ${montant}`);
      return checkMontant(req, res, next, montant);
    }
    
    console.log('✅ Pas d\'action ni de montant - Passage autorisé');
    return next();
  }
  
  // Normaliser l'action
  const normalizedAction = action.toUpperCase().trim();
  console.log(`🔍 Action reçue: "${action}" -> "${normalizedAction}"`);
  
  // Si c'est une action qui ne nécessite PAS de montant
  if (actionsWithoutAmount.includes(normalizedAction)) {
    console.log(`✅ Action "${normalizedAction}" ne nécessite pas de montant`);
    return next();
  }
  
  // Si c'est une action qui nécessite un montant
  if (actionsRequiringAmount.includes(normalizedAction)) {
    console.log(`🔍 Action "${normalizedAction}" nécessite un montant`);
    
    const montant = req.body.montant || req.body.montantAutorise;
    
    if (montant === undefined || montant === null) {
      console.log(`❌ Montant requis pour l'action "${normalizedAction}"`);
      return errorResponse(res, 400, `Montant requis pour l'action "${action}"`);
    }
    
    console.log(`💰 Montant trouvé: ${montant}`);
    return checkMontant(req, res, next, montant);
  }
  
  // Action non reconnue
  console.log(`⚠️ Action "${normalizedAction}" non reconnue`);
  
  // Pour les actions non reconnues, vérifier s'il y a un montant
  const montant = req.body.montant || req.body.montantAutorise;
  
  if (montant !== undefined && montant !== null) {
    console.log(`💰 Montant trouvé pour action non reconnue: ${montant}`);
    return checkMontant(req, res, next, montant);
  }
  
  console.log('✅ Pas de montant pour action non reconnue - Passage autorisé');
  return next();
};

// Fonction helper pour vérifier le montant
function checkMontant(req, res, next, montant) {
  console.log(`🔍 Vérification montant: ${montant}`);
  
  // Valider que le montant est un nombre
  if (isNaN(montant) || montant < 0) {
    console.log(`❌ Montant invalide: ${montant}`);
    return errorResponse(res, 400, 'Montant invalide');
  }
  
  // Convertir en nombre
  const montantNum = Number(montant);
  
  // Si montant = 0, c'est toujours OK
  if (montantNum === 0) {
    console.log('✅ Montant = 0, autorisé');
    return next();
  }
  
  // Utiliser PermissionHelper pour vérifier la limite
  if (!PermissionHelper.canAuthorizeMontant(req.user.role, montantNum)) {
    const { LIMITES_AUTORISATION } = require('../constants/roles');
    const limite = LIMITES_AUTORISATION[req.user.role] || 0;
    
    console.log(`❌ PermissionHelper a refusé le montant ${montantNum} pour le rôle ${req.user.role}`);
    return errorResponse(
      res, 
      403, 
      `Montant (${montantNum} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }
  
  console.log('✅ Montant autorisé par PermissionHelper');
  return next();
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAuthorizationLimit
};