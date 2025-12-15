// ============================================
// 4. MIDDLEWARE - src/middleware/auth.middleware.js
// ============================================
const { verifyToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Token manquant');
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return errorResponse(res, 401, 'Utilisateur non trouvé ou inactif');
    }
    
    req.userId = user._id;
    req.userRole = user.role;
    req.user = user;
    
    next();
  } catch (error) {
    return errorResponse(res, 401, 'Token invalide ou expiré');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return errorResponse(res, 401, 'Non authentifié');
    }
    
    if (roles.length && !roles.includes(req.userRole)) {
      return errorResponse(res, 403, 'Accès refusé - Rôle insuffisant');
    }
    
    next();
  };
};

const canAuthorize = (req, res, next) => {
  const montant = req.body.montant || req.body.montantAutorise;
  
  if (!montant) {
    return errorResponse(res, 400, 'Montant requis');
  }
  
  if (!req.user.peutAutoriser(montant)) {
    return errorResponse(
      res, 
      403, 
      `Montant dépasse votre limite d'autorisation (${req.user.limiteAutorisation} FCFA)`
    );
  }
  
  next();
};

const sameAgency = async (req, res, next) => {
  if (['admin', 'dga', 'risques'].includes(req.userRole)) {
    return next();
  }
  
  const demandeId = req.params.id;
  const DemandeForçage = require('../models/DemandeForçage');
  
  const demande = await DemandeForçage.findById(demandeId).populate('client');
  
  if (!demande) {
    return errorResponse(res, 404, 'Demande introuvable');
  }
  
  if (req.user.agence !== demande.client.agence) {
    return errorResponse(res, 403, 'Accès refusé - Agence différente');
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  canAuthorize,
  sameAgency
};