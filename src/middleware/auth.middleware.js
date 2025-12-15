// middleware/auth.middleware.js - Version optimisée
const { verifyToken, getUserFromToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Token manquant');
    }
    
    const token = authHeader.substring(7);
    
    // OPTIMISATION: Récupérer directement depuis le token
    const user = getUserFromToken(token);
    
    if (!user) {
      return errorResponse(res, 401, 'Token invalide ou expiré');
    }
    
    if (!user.isActive) {
      return errorResponse(res, 401, 'Compte désactivé');
    }
    
    // Ajouter l'utilisateur à la requête
    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    req.token = token;
    
    next();
  } catch (error) {
    return errorResponse(res, 401, 'Token invalide ou expiré');
  }
};


const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.userRole) {
      return errorResponse(res, 401, 'Non authentifié');
    }
    
    if (roles.length && !roles.includes(req.userRole)) {
      return errorResponse(res, 403, `Accès refusé. Rôles autorisés: ${roles.join(', ')}`);
    }
    
    next();
  };
};

// Raccourcis pour les rôles courants
const requireAdmin = authorize('admin', 'dga', 'adg');
const requireManager = authorize('rm', 'dce');
const requireConseiller = authorize('conseiller');
const requireClient = authorize('client');

// Middleware pour vérifier la limite d'autorisation
const canAuthorize = (req, res, next) => {
  const montant = req.body.montant || req.body.montantAutorise;
  
  if (!montant) {
    return errorResponse(res, 400, 'Montant requis');
  }
  
  // OPTIMISATION: limiteAutorisation est déjà dans req.user depuis le token
  if (req.user.limiteAutorisation < montant && req.user.role !== 'admin') {
    return errorResponse(
      res, 
      403, 
      `Montant (${montant} FCFA) dépasse votre limite d'autorisation (${req.user.limiteAutorisation} FCFA)`
    );
  }
  
  next();
};

// Vérifier si l'utilisateur est dans la même agence
const sameAgency = async (req, res, next) => {
  // Les rôles supérieurs ont accès à tout
  if (['admin', 'dga', 'risques'].includes(req.user.role)) {
    return next();
  }
  
  const demandeId = req.params.id;
  const DemandeForçage = require('../models/DemandeForçage');
  
  const demande = await DemandeForçage.findById(demandeId).populate('client', 'agence');
  
  if (!demande) {
    return errorResponse(res, 404, 'Demande introuvable');
  }
  
  // OPTIMISATION: req.user.agence est déjà disponible depuis le token
  if (req.user.agence !== demande.client.agence) {
    return errorResponse(res, 403, 'Accès refusé - Agence différente');
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  canAuthorize,
  sameAgency,
  requireAdmin,
  requireManager,
  requireConseiller,
  requireClient
};