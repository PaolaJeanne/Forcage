// src/middlewares/permission.middleware.js - VERSION COMPLÈTE CORRIGÉE
const PermissionHelper = require('../helpers/permission.helper');
const { errorResponse } = require('../utils/response.util');

/**
 * Middleware pour vérifier une permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    console.log('🔐 [REQUIRE_PERMISSION] Vérification permission:', permission);
    console.log('👤 Utilisateur:', req.user?.email, 'Rôle:', req.user?.role);

    if (!req.user) {
      console.error('❌ [REQUIRE_PERMISSION] Non authentifié');
      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasPermission(req.user.role, permission)) {
      console.error('❌ [REQUIRE_PERMISSION] Permission refusée');
      console.log('📋 Permission requise:', permission);
      console.log('📋 Rôle utilisateur:', req.user.role);
      console.log('📋 Permissions disponibles:', PermissionHelper.getRolePermissions(req.user.role));
      
      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir la permission: ${permission}`
      );
    }

    console.log('✅ [REQUIRE_PERMISSION] Permission accordée');
    next();
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (OU)
 */
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    console.log('🔐 [REQUIRE_ANY_PERMISSION] Vérification permissions (OU):', permissions);
    console.log('👤 Utilisateur:', req.user?.email, 'Rôle:', req.user?.role);

    if (!req.user) {
      console.error('❌ [REQUIRE_ANY_PERMISSION] Non authentifié');
      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasAnyPermission(req.user.role, permissions)) {
      console.error('❌ [REQUIRE_ANY_PERMISSION] Aucune permission valide');
      console.log('📋 Permissions requises:', permissions);
      console.log('📋 Rôle utilisateur:', req.user.role);
      
      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir l'une de ces permissions: ${permissions.join(', ')}`
      );
    }

    console.log('✅ [REQUIRE_ANY_PERMISSION] Au moins une permission accordée');
    next();
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (ET)
 */
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    console.log('🔐 [REQUIRE_ALL_PERMISSIONS] Vérification permissions (ET):', permissions);
    console.log('👤 Utilisateur:', req.user?.email, 'Rôle:', req.user?.role);

    if (!req.user) {
      console.error('❌ [REQUIRE_ALL_PERMISSIONS] Non authentifié');
      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasAllPermissions(req.user.role, permissions)) {
      console.error('❌ [REQUIRE_ALL_PERMISSIONS] Pas toutes les permissions');
      console.log('📋 Permissions requises:', permissions);
      console.log('📋 Rôle utilisateur:', req.user.role);
      
      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir toutes ces permissions: ${permissions.join(', ')}`
      );
    }

    console.log('✅ [REQUIRE_ALL_PERMISSIONS] Toutes permissions accordées');
    next();
  };
};

/**
 * Middleware pour vérifier la limite d'autorisation - VERSION CORRIGÉE
 */
const requireAuthorizationLimit = (req, res, next) => {
  console.log('💰 [REQUIRE_AUTHORIZATION_LIMIT] Vérification limite d\'autorisation');
  console.log('👤 Utilisateur:', req.user?.email, 'Rôle:', req.user?.role);

  if (!req.user) {
    console.error('❌ [REQUIRE_AUTHORIZATION_LIMIT] Non authentifié');
    return errorResponse(res, 401, 'Non authentifié');
  }

  console.log('📋 Body:', JSON.stringify(req.body, null, 2));

  // Actions qui nécessitent un montant (opérations financières)
  const actionsRequiringAmount = [
    'AUTORISER', 'APPROUVER', 'ACCORDER',
    'AUTHORIZE', 'APPROVE', 'GRANT',
    'VALIDER_MONTANT', 'APPROUVER_MONTANT'
  ];

  // Actions qui ne nécessitent PAS de montant (actions de workflow)
  const actionsWithoutAmount = [
    'VALIDER', 'REJETER', 'RETOURNER', 'ANNULER', 'ETUDIER',
    'VALIDATE', 'REJECT', 'RETURN', 'CANCEL', 'STUDY',
    'PRENDRE_EN_CHARGE', 'ASSIGNER', 'TRANSFERER'
  ];

  const { action } = req.body;

  // Si pas d'action spécifiée
  if (!action) {
    console.log('⚠️ [REQUIRE_AUTHORIZATION_LIMIT] Pas d\'action spécifiée');

    // Vérifier s'il y a un montant sans action
    const montant = req.body.montant || req.body.montantAutorise || req.body.amount;

    if (montant !== undefined && montant !== null) {
      console.log('💰 [REQUIRE_AUTHORIZATION_LIMIT] Montant trouvé sans action:', montant);
      return checkMontant(req, res, next, montant);
    }

    console.log('✅ [REQUIRE_AUTHORIZATION_LIMIT] Pas de montant - autorisation accordée');
    return next();
  }

  // Normaliser l'action
  const normalizedAction = action.toUpperCase().trim();
  console.log('📋 [REQUIRE_AUTHORIZATION_LIMIT] Action normalisée:', normalizedAction);

  // Si c'est une action qui ne nécessite PAS de montant
  if (actionsWithoutAmount.includes(normalizedAction)) {
    console.log('✅ [REQUIRE_AUTHORIZATION_LIMIT] Action sans montant - autorisation accordée');
    return next();
  }

  // Si c'est une action qui nécessite un montant
  if (actionsRequiringAmount.includes(normalizedAction)) {
    console.log('💰 [REQUIRE_AUTHORIZATION_LIMIT] Action nécessitant montant');

    const montant = req.body.montant || req.body.montantAutorise || req.body.amount;

    if (montant === undefined || montant === null) {
      console.error('❌ [REQUIRE_AUTHORIZATION_LIMIT] Montant requis manquant');
      return errorResponse(res, 400, `Montant requis pour l'action "${action}"`);
    }

    console.log('💰 [REQUIRE_AUTHORIZATION_LIMIT] Montant trouvé:', montant);
    return checkMontant(req, res, next, montant);
  }

  // Action non reconnue
  console.log('⚠️ [REQUIRE_AUTHORIZATION_LIMIT] Action non reconnue:', normalizedAction);

  // Pour les actions non reconnues, vérifier s'il y a un montant
  const montant = req.body.montant || req.body.montantAutorise || req.body.amount;

  if (montant !== undefined && montant !== null) {
    console.log('💰 [REQUIRE_AUTHORIZATION_LIMIT] Montant trouvé pour action non reconnue:', montant);
    return checkMontant(req, res, next, montant);
  }

  console.log('✅ [REQUIRE_AUTHORIZATION_LIMIT] Action non reconnue sans montant - autorisation accordée');
  return next();
};

// Fonction helper pour vérifier le montant
function checkMontant(req, res, next, montant) {
  console.log('💰 [CHECK_MONTANT] Vérification montant:', montant);
  console.log('👤 Rôle utilisateur:', req.user.role);

  // Valider que le montant est un nombre
  if (isNaN(montant) || montant < 0) {
    console.error('❌ [CHECK_MONTANT] Montant invalide');
    return errorResponse(res, 400, 'Montant invalide');
  }

  // Convertir en nombre
  const montantNum = Number(montant);
  console.log('💰 [CHECK_MONTANT] Montant numérique:', montantNum);

  // Si montant = 0, c'est toujours OK
  if (montantNum === 0) {
    console.log('✅ [CHECK_MONTANT] Montant = 0 - autorisation accordée');
    return next();
  }

  // Utiliser PermissionHelper pour vérifier la limite
  if (!PermissionHelper.canAuthorizeMontant(req.user.role, montantNum)) {
    const { LIMITES_AUTORISATION } = require('../constants/roles');
    const limite = LIMITES_AUTORISATION[req.user.role] || 0;

    console.error('❌ [CHECK_MONTANT] Limite dépassée');
    console.log('📋 Montant:', montantNum);
    console.log('📋 Limite autorisée:', limite);
    console.log('📋 Rôle:', req.user.role);

    return errorResponse(
      res,
      403,
      `Montant (${montantNum} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }

  console.log('✅ [CHECK_MONTANT] Limite respectée');
  return next();
}

/**
 * Middleware pour vérifier l'accès à une agence
 */
const requireAgencyAccess = async (req, res, next) => {
  try {
    console.log('🏢 [REQUIRE_AGENCY_ACCESS] Vérification accès agence');
    
    if (!req.user) {
      return errorResponse(res, 401, 'Non authentifié');
    }

    // Rôles qui n'ont pas besoin d'agence
    if (['admin', 'dga', 'risques'].includes(req.user.role)) {
      console.log('✅ [REQUIRE_AGENCY_ACCESS] Rôle supérieur - pas besoin d\'agence');
      return next();
    }

    // Rôles qui doivent avoir une agence
    const rolesRequiringAgency = ['conseiller', 'rm', 'dce', 'adg'];
    
    if (rolesRequiringAgency.includes(req.user.role)) {
      if (!req.user.agencyId && !req.user.agence) {
        console.error('❌ [REQUIRE_AGENCY_ACCESS] Utilisateur sans agence');
        return errorResponse(res, 403, 'Vous devez être assigné à une agence');
      }
      
      console.log('✅ [REQUIRE_AGENCY_ACCESS] Utilisateur avec agence valide');
      console.log('📋 Agence:', req.user.agence);
      console.log('📋 AgencyId:', req.user.agencyId);
    }

    next();
  } catch (error) {
    console.error('❌ [REQUIRE_AGENCY_ACCESS] Erreur:', error);
    return errorResponse(res, 500, 'Erreur de vérification d\'agence');
  }
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAuthorizationLimit,
  requireAgencyAccess
};