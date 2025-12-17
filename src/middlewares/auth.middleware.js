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


// middlewares/auth.middleware.js - AJOUTEZ CES FONCTIONS

// Middleware pour vérifier les permissions sur une demande
const canViewDemande = async (req, res, next) => {
  try {
    const DemandeForçage = require('../models/DemandeForçage');
    const demande = await DemandeForçage.findById(req.params.id);
    
    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }
    
    // Admins et rôles supérieurs voient tout
    if (['admin', 'dga', 'adg', 'risques'].includes(req.user.role)) {
      req.demande = demande;
      return next();
    }
    
    // Client: ne voit que ses propres demandes
    if (req.user.role === 'client') {
      if (demande.clientId.toString() === req.user.id) {
        req.demande = demande;
        return next();
      }
      return errorResponse(res, 403, 'Accès non autorisé');
    }
    
    // Conseiller/RM/DCE: voient les demandes de leur agence
    if (['conseiller', 'rm', 'dce'].includes(req.user.role)) {
      // On doit récupérer le client pour connaître son agence
      const User = require('../models/User');
      const client = await User.findById(demande.clientId);
      
      if (client && client.agence === req.user.agence) {
        req.demande = demande;
        return next();
      }
      return errorResponse(res, 403, 'Demande hors de votre agence');
    }
    
    return errorResponse(res, 403, 'Accès non autorisé');
  } catch (error) {
    return errorResponse(res, 500, 'Erreur de permission');
  }
};

// Middleware pour créer une demande (clients seulement)
const canCreateDemande = (req, res, next) => {
  if (req.user.role !== 'client') {
    return errorResponse(res, 403, 'Seuls les clients peuvent créer des demandes');
  }
  next();
};

// Middleware pour traiter une demande (conseillers et supérieurs)
const canProcessDemande = async (req, res, next) => {
  try {
    const DemandeForçage = require('../models/DemandeForçage');
    const demande = await DemandeForçage.findById(req.params.id);
    
    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }
    
    // Admins et rôles supérieurs peuvent tout traiter
    if (['admin', 'dga', 'adg', 'risques'].includes(req.user.role)) {
      req.demande = demande;
      return next();
    }
    
    // Conseillers/RM/DCE peuvent traiter selon workflow
    if (['conseiller', 'rm', 'dce'].includes(req.user.role)) {
      // Vérifier que la demande est dans leur agence
      const User = require('../models/User');
      const client = await User.findById(demande.clientId);
      
      if (client && client.agence === req.user.agence) {
        req.demande = demande;
        return next();
      }
      return errorResponse(res, 403, 'Demande hors de votre agence');
    }
    
    return errorResponse(res, 403, 'Vous n\'avez pas les droits pour traiter cette demande');
  } catch (error) {
    return errorResponse(res, 500, 'Erreur de permission');
  }
};

// Middleware pour workflow hiérarchique
const requireNextLevel = async (req, res, next) => {
  const DemandeForçage = require('../models/DemandeForçage');
  const demande = await DemandeForçage.findById(req.params.id);
  
  if (!demande) {
    return errorResponse(res, 404, 'Demande introuvable');
  }
  
  // Logique de workflow hiérarchique
  switch (demande.statut) {
    case 'ENVOYEE':
      // Peut être prise en charge par conseiller ou supérieur
      if (['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
        return next();
      }
      break;
      
    case 'EN_ETUDE':
      // Peut être validée par RM ou supérieur
      if (['rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
        return next();
      }
      break;
      
    case 'EN_VALIDATION':
      // Peut être validée par DCE ou supérieur
      if (['dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
        return next();
      }
      break;
  }
  
  return errorResponse(res, 403, 'Niveau hiérarchique insuffisant pour cette action');
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
  requireClient,
  canViewDemande,
  canCreateDemande,
  canProcessDemande,
  requireNextLevel
};