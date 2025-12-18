// middleware/auth.middleware.js - VERSION AVEC LOGS DÉTAILLÉS
const { verifyToken, getUserFromToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');

const authenticate = async (req, res, next) => {
  console.log('\n🔐 ===== AUTHENTICATE MIDDLEWARE DÉBUT =====');
  console.log('📍 URL:', req.url);
  console.log('📝 Méthode:', req.method);
  console.log('⏰ Heure:', new Date().toISOString());
  
  try {
    const authHeader = req.headers.authorization;
    console.log('🔑 Authorization Header:', authHeader || 'NON PRÉSENT');
    
    if (!authHeader) {
      console.log('❌ ERREUR: Pas de header Authorization');
      return errorResponse(res, 401, 'Token manquant');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ ERREUR: Mauvais format. Doit commencer par "Bearer "');
      console.log('   Reçu:', authHeader.substring(0, 50) + '...');
      return errorResponse(res, 401, 'Format token invalide');
    }
    
    const token = authHeader.substring(7);
    console.log('🎫 Token extrait (longueur):', token.length, 'caractères');
    console.log('🎫 Token preview:', token.substring(0, 30) + '...');
    
    if (!token || token === '') {
      console.log('❌ ERREUR: Token vide après Bearer');
      return errorResponse(res, 401, 'Token vide');
    }
    
    console.log('🔍 Appel de getUserFromToken...');
    const user = getUserFromToken(token);
    
    if (!user) {
      console.log('❌ ERREUR: getUserFromToken retourne null/undefined');
      console.log('💡 Causes possibles:');
      console.log('   1. Token expiré');
      console.log('   2. Mauvais JWT_SECRET');
      console.log('   3. Signature invalide');
      console.log('   4. Token mal formé');
      return errorResponse(res, 401, 'Token invalide ou expiré');
    }
    
    console.log('✅ SUCCÈS: Token valide!');
    console.log('👤 User object:', {
      id: user.id,
      userId: user.userId,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
    
    if (!user.isActive) {
      console.log('❌ ERREUR: Compte désactivé');
      return errorResponse(res, 401, 'Compte désactivé');
    }
    
    // Vérifier que l'ID est présent
    if (!user.id && !user.userId) {
      console.log('❌ ERREUR: Token ne contient pas d\'ID utilisateur');
      return errorResponse(res, 401, 'Token mal formé');
    }
    
    // Ajouter l'utilisateur à la requête
    req.user = user;
    req.userId = user.id || user.userId;
    req.userRole = user.role;
    req.token = token;
    
    console.log('🔐 ===== AUTHENTICATE MIDDLEWARE FIN =====\n');
    next();
    
  } catch (error) {
    console.error('🔥 ERREUR CRITIQUE dans authenticate:', error.message);
    console.error('🔥 Stack:', error.stack);
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
// Middleware pour vérifier la limite d'autorisation - VERSION CORRIGÉE
const canAuthorize = (req, res, next) => {
  console.log('\n💰 ===== CAN AUTHORIZE MIDDLEWARE =====');
  console.log('📍 URL:', req.url);
  console.log('📝 Méthode:', req.method);
  console.log('📦 Body:', req.body);
  
  // Actions qui nécessitent un montant
  const actionsRequiringAmount = ['AUTORISER', 'APPROUVER', 'ACCORDER', 'VALIDER_AVEC_MONTANT'];
  
  // Actions qui ne nécessitent PAS de montant
  const actionsWithoutAmount = ['VALIDER', 'REJETER', 'RETOURNER', 'ANNULER', 'ETUDIER', 'PRENDRE_EN_CHARGE'];
  
  const { action } = req.body;
  
  // Si pas d'action spécifiée, vérifier s'il y a un montant
  if (!action) {
    console.log('⚠️  Pas d\'action spécifiée, vérification du montant...');
    const montant = req.body.montant || req.body.montantAutorise;
    
    if (montant) {
      console.log('💰 Montant trouvé:', montant);
      return checkAmountLimit(req, res, next, montant);
    } else {
      console.log('✅ Pas de montant, passage autorisé');
      return next();
    }
  }
  
  // Si c'est une action qui nécessite un montant
  if (actionsRequiringAmount.includes(action)) {
    console.log(`🔍 Action "${action}" nécessite un montant`);
    const montant = req.body.montant || req.body.montantAutorise;
    
    if (!montant) {
      console.log('❌ ERREUR: Montant requis pour l\'action', action);
      return errorResponse(res, 400, `Montant requis pour l'action "${action}"`);
    }
    
    return checkAmountLimit(req, res, next, montant);
  }
  
  // Si c'est une action qui ne nécessite PAS de montant
  if (actionsWithoutAmount.includes(action)) {
    console.log(`✅ Action "${action}" ne nécessite pas de montant`);
    return next();
  }
  
  // Action non reconnue - vérifier s'il y a un montant
  console.log(`⚠️  Action "${action}" non reconnue, vérification conditionnelle`);
  const montant = req.body.montant || req.body.montantAutorise;
  
  if (montant) {
    console.log('💰 Montant trouvé, vérification des limites');
    return checkAmountLimit(req, res, next, montant);
  }
  
  console.log('✅ Pas de montant, passage autorisé');
  next();
};

// Fonction helper pour vérifier la limite
function checkAmountLimit(req, res, next, montant) {
  console.log('🔍 Vérification limite d\'autorisation...');
  console.log('   User limite:', req.user.limiteAutorisation);
  console.log('   Montant demandé:', montant);
  console.log('   Role:', req.user.role);
  
  if (req.user.limiteAutorisation < montant && req.user.role !== 'admin') {
    console.log(`❌ ERREUR: Limite dépassée (${montant} > ${req.user.limiteAutorisation})`);
    return errorResponse(
      res, 
      403, 
      `Montant (${montant} FCFA) dépasse votre limite d'autorisation (${req.user.limiteAutorisation} FCFA)`
    );
  }
  
  console.log('✅ Limite OK');
  next();
}

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