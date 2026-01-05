// src/middlewares/checkRole.js - Version améliorée avec logs
console.log('[DEBUG] Chargement du middleware checkRole...');

const { errorResponse } = require('../utils/response.util');

const checkRole = (...allowedRoles) => {
  console.log(`[DEBUG] checkRole créé avec rôles: ${allowedRoles.join(', ')}`);
  
  return (req, res, next) => {
    console.log('[DEBUG] Middleware checkRole exécution:', {
      path: req.path,
      method: req.method,
      user: req.user ? 'présent' : 'absent',
      userRole: req.userRole || (req.user ? req.user.role : 'non défini')
    });
    
    // En mode développement, bypass temporairement
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      console.log('[DEBUG] Mode développement - bypass du checkRole');
      return next();
    }
    
    // Vérifier si userRole est défini
    if (!req.userRole && req.user && req.user.role) {
      req.userRole = req.user.role;
    }
    
    // Vérification basique
    if (!req.userRole) {
      console.error('[DEBUG] checkRole: Utilisateur non authentifié');
      return errorResponse(res, 401, 'Accès non autorisé. Utilisateur non authentifié.');
    }
    
    // Vérifier le rôle
    if (!allowedRoles.includes(req.userRole)) {
      console.error('[DEBUG] checkRole: Rôle non autorisé', {
        role: req.userRole,
        allowedRoles
      });
      return errorResponse(res, 403, {
        message: `Accès refusé. Rôle requis: ${allowedRoles.join(', ')}`,
        yourRole: req.userRole,
        allowedRoles
      });
    }
    
    console.log('[DEBUG] checkRole: Accès autorisé pour rôle', req.userRole);
    next();
  };
};

module.exports = checkRole;