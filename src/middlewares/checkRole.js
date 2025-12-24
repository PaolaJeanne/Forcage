// src/middlewares/checkRole.js - Version avec logs
console.log('[DEBUG] Chargement du middleware checkRole...');

const checkRole = (...allowedRoles) => {
  console.log(`[DEBUG] checkRole appelé avec rôles: ${allowedRoles.join(', ')}`);
  
  return (req, res, next) => {
    console.log('[DEBUG] Middleware checkRole exécution:', {
      path: req.path,
      method: req.method,
      user: req.user ? 'présent' : 'absent',
      userRole: req.userRole || (req.user ? req.user.role : 'non défini')
    });
    
    // En mode développement, bypass temporairement
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] Mode développement - bypass du checkRole');
      return next();
    }
    
    // Vérifier si userRole est défini
    if (!req.userRole && req.user && req.user.role) {
      req.userRole = req.user.role;
    }
    
    // Vérification basique
    if (!req.userRole) {
      return res.status(401).json({
        success: false,
        message: 'Accès non autorisé. Utilisateur non authentifié.'
      });
    }
    
    // Vérifier le rôle
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis: ${allowedRoles.join(', ')}`,
        yourRole: req.userRole
      });
    }
    
    next();
  };
};

module.exports = checkRole;