// middleware/auth.middleware.js - VERSION COMPLÈTE CORRIGÉE
const { verifyToken, getUserFromToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');

/**
 * Middleware d'authentification principal
 * Vérifie le token JWT et ajoute l'utilisateur à req.user
 */
const authenticate = async (req, res, next) => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔐 [AUTHENTICATE] Début de l\'authentification');
    console.log('📍 Route:', req.method, req.path);
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const authHeader = req.headers.authorization;
    console.log('🔐 [AUTHENTICATE] Authorization header:', authHeader ? '✅ Présent' : '❌ Manquant');

    if (!authHeader) {
      console.error('❌ [AUTHENTICATE] ERREUR: Token manquant');
      console.log('📋 Headers reçus:', Object.keys(req.headers));
      return errorResponse(res, 401, 'Token manquant');
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.error('❌ [AUTHENTICATE] ERREUR: Format token invalide');
      console.log('📋 Format reçu:', authHeader.substring(0, 20) + '...');
      return errorResponse(res, 401, 'Format token invalide');
    }

    const token = authHeader.substring(7);
    console.log('🔑 [AUTHENTICATE] Token extrait - Longueur:', token.length);
    console.log('� [AUTeHENTICATE] Token (premiers 50 chars):', token.substring(0, 50) + '...');

    if (!token || token === '') {
      console.error('❌ [AUTHENTICATE] ERREUR: Token vide');
      return errorResponse(res, 401, 'Token vide');
    }

    console.log('🔍 [AUTHENTICATE] Décodage du token...');
    const user = getUserFromToken(token);
    
    if (!user) {
      console.error('❌ [AUTHENTICATE] ERREUR: Token invalide ou expiré');
      console.log('📋 Raison: getUserFromToken retourna null');
      return errorResponse(res, 401, 'Token invalide ou expiré');
    }

    console.log('👤 [AUTHENTICATE] Utilisateur décodé:', {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });

    if (!user.isActive) {
      console.error('❌ [AUTHENTICATE] ERREUR: Compte désactivé');
      console.log('📋 Email:', user.email);
      return errorResponse(res, 401, 'Compte désactivé');
    }

    // ✅ CORRECTION CRITIQUE - Assurer que user.id existe
    const userId = user._id || user.id || user.userId;
    
    if (!userId) {
      console.error('❌ [AUTHENTICATE] ERREUR: Token mal formé - Pas d\'ID utilisateur');
      console.log('📋 Objet user:', JSON.stringify(user, null, 2));
      return errorResponse(res, 401, 'Token mal formé');
    }

    // ✅ Normaliser l'objet utilisateur avec tous les formats d'ID
    req.user = {
      ...user,
      id: userId,           // Format standard
      _id: userId,          // Format MongoDB
      userId: userId        // Format legacy
    };
    
    req.userId = userId;
    req.userRole = user.role;
    req.token = token;

    console.log('✅ [AUTHENTICATE] Authentification réussie!');
    console.log('📊 Utilisateur normalisé:', {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      agence: req.user.agence,
      agencyId: req.user.agencyId
    });
    console.log('='.repeat(80) + '\n');

    next();

  } catch (error) {
    console.error('❌ [AUTHENTICATE] ERREUR EXCEPTION:', error.message);
    console.error('📋 Stack:', error.stack);
    return errorResponse(res, 401, 'Token invalide ou expiré');
  }
};

/**
 * Middleware d'autorisation par rôle
 * Vérifie que l'utilisateur a l'un des rôles autorisés
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('\n' + '='.repeat(80));
    console.log('� [AUToHORIZE] Vérification des rôles');
    console.log('📍 Route:', req.method, req.path);
    console.log('🔒 [AUTHORIZE] Rôles autorisés:', roles);
    console.log('👤 [AUTHORIZE] Rôle utilisateur:', req.userRole);

    if (!req.user || !req.userRole) {
      console.error('❌ [AUTHORIZE] ERREUR: Non authentifié');
      console.log('📋 req.user:', req.user ? 'Présent' : 'Manquant');
      console.log('📋 req.userRole:', req.userRole ? 'Présent' : 'Manquant');
      console.log('='.repeat(80) + '\n');
      return errorResponse(res, 401, 'Non authentifié');
    }

    if (roles.length && !roles.includes(req.userRole)) {
      console.error('❌ [AUTHORIZE] ERREUR: Accès refusé');
      console.log('📋 Rôle requis:', roles);
      console.log('📋 Rôle actuel:', req.userRole);
      console.log('📋 Email utilisateur:', req.user.email);
      console.log('='.repeat(80) + '\n');
      return errorResponse(res, 403, `Accès refusé. Rôles autorisés: ${roles.join(', ')}`);
    }

    console.log('✅ [AUTHORIZE] Autorisation accordée!');
    console.log('📊 Utilisateur autorisé:', {
      email: req.user.email,
      role: req.userRole,
      agence: req.user.agence
    });
    console.log('='.repeat(80) + '\n');
    next();
  };
};

/**
 * Middleware pour vérifier les permissions sur une demande
 */
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
    console.error('❌ canViewDemande:', error);
    return errorResponse(res, 500, 'Erreur de permission');
  }
};

/**
 * Middleware pour créer une demande (clients seulement)
 */
const canCreateDemande = (req, res, next) => {
  if (req.user.role !== 'client') {
    return errorResponse(res, 403, 'Seuls les clients peuvent créer des demandes');
  }
  next();
};

/**
 * Middleware pour traiter une demande (conseillers et supérieurs)
 */
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
    console.error('❌ canProcessDemande:', error);
    return errorResponse(res, 500, 'Erreur de permission');
  }
};

/**
 * Middleware pour workflow hiérarchique
 */
const requireNextLevel = async (req, res, next) => {
  try {
    const DemandeForçage = require('../models/DemandeForçage');
    const demande = await DemandeForçage.findById(req.params.id);

    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }

    // Logique de workflow hiérarchique
    switch (demande.statut) {
      case 'ENVOYEE':
        if (['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      case 'EN_ETUDE':
        if (['rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      case 'EN_VALIDATION':
        if (['dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      default:
        if (['admin', 'dga', 'risques'].includes(req.user.role)) {
          return next();
        }
    }

    return errorResponse(res, 403, 'Niveau hiérarchique insuffisant pour cette action');
  } catch (error) {
    console.error('❌ requireNextLevel:', error);
    return errorResponse(res, 500, 'Erreur de permission');
  }
};

/**
 * Middleware pour vérifier la limite d'autorisation
 */
const canAuthorize = (req, res, next) => {
  console.log('💰 canAuthorize: Vérification limite d\'autorisation');

  // Actions qui nécessitent un montant
  const actionsRequiringAmount = ['AUTORISER', 'APPROUVER', 'ACCORDER', 'VALIDER_AVEC_MONTANT'];

  // Actions qui ne nécessitent PAS de montant
  const actionsWithoutAmount = ['VALIDER', 'REJETER', 'RETOURNER', 'ANNULER', 'ETUDIER', 'PRENDRE_EN_CHARGE'];

  const { action } = req.body;

  // Si pas d'action spécifiée, vérifier s'il y a un montant
  if (!action) {
    console.log('💰 canAuthorize: Pas d\'action spécifiée');
    const montant = req.body.montant || req.body.montantAutorise;

    if (montant) {
      console.log('💰 canAuthorize: Montant trouvé:', montant);
      return checkAmountLimit(req, res, next, montant);
    } else {
      console.log('💰 canAuthorize: Pas de montant - autorisation accordée');
      return next();
    }
  }

  // Si c'est une action qui nécessite un montant
  if (actionsRequiringAmount.includes(action)) {
    console.log('💰 canAuthorize: Action nécessitant montant:', action);
    const montant = req.body.montant || req.body.montantAutorise;

    if (!montant) {
      console.error('❌ canAuthorize: Montant requis manquant pour:', action);
      return errorResponse(res, 400, `Montant requis pour l'action "${action}"`);
    }

    return checkAmountLimit(req, res, next, montant);
  }

  // Si c'est une action qui ne nécessite PAS de montant
  if (actionsWithoutAmount.includes(action)) {
    console.log('✅ canAuthorize: Action sans montant:', action);
    return next();
  }

  // Action non reconnue - vérifier s'il y a un montant
  console.log('⚠️ canAuthorize: Action non reconnue:', action);
  const montant = req.body.montant || req.body.montantAutorise;

  if (montant) {
    console.log('💰 canAuthorize: Montant trouvé pour action non reconnue:', montant);
    return checkAmountLimit(req, res, next, montant);
  }

  console.log('✅ canAuthorize: Pas de montant - autorisation accordée');
  next();
};

/**
 * Fonction helper pour vérifier la limite de montant
 */
function checkAmountLimit(req, res, next, montant) {
  console.log('💰 checkAmountLimit: Montant:', montant);
  console.log('💰 checkAmountLimit: Limite utilisateur:', req.user.limiteAutorisation);

  if (req.user.limiteAutorisation < montant && req.user.role !== 'admin') {
    console.error('❌ checkAmountLimit: Limite dépassée');
    return errorResponse(
      res,
      403,
      `Montant (${montant} FCFA) dépasse votre limite d'autorisation (${req.user.limiteAutorisation} FCFA)`
    );
  }

  console.log('✅ checkAmountLimit: Limite respectée');
  next();
}

/**
 * Vérifier si l'utilisateur est dans la même agence
 */
const sameAgency = async (req, res, next) => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🏢 [SAME_AGENCY] Vérification agence');
    console.log('📍 Route:', req.method, req.path);
    console.log('👤 [SAME_AGENCY] Rôle utilisateur:', req.user.role);
    console.log('🏢 [SAME_AGENCY] Agence utilisateur:', req.user.agence);

    // Les rôles supérieurs ont accès à tout
    if (['admin', 'dga', 'risques'].includes(req.user.role)) {
      console.log('✅ [SAME_AGENCY] Rôle supérieur - Accès complet');
      console.log('='.repeat(80) + '\n');
      return next();
    }

    const demandeId = req.params.id;
    console.log('📋 [SAME_AGENCY] Demande ID:', demandeId);
    
    const DemandeForçage = require('../models/DemandeForçage');

    const demande = await DemandeForçage.findById(demandeId).populate('clientId', 'agence');

    if (!demande) {
      console.error('❌ [SAME_AGENCY] ERREUR: Demande introuvable');
      console.log('📋 Demande ID:', demandeId);
      console.log('='.repeat(80) + '\n');
      return errorResponse(res, 404, 'Demande introuvable');
    }

    console.log('📋 [SAME_AGENCY] Demande trouvée:', {
      id: demande._id,
      agence: demande.clientId?.agence,
      client: demande.clientId?.email
    });

    if (req.user.agence !== demande.clientId.agence) {
      console.error('❌ [SAME_AGENCY] ERREUR: Agence différente');
      console.log('📋 Agence utilisateur:', req.user.agence);
      console.log('📋 Agence demande:', demande.clientId.agence);
      console.log('='.repeat(80) + '\n');
      return errorResponse(res, 403, 'Accès refusé - Agence différente');
    }

    console.log('✅ [SAME_AGENCY] Agence vérifiée - Accès accordé');
    console.log('='.repeat(80) + '\n');
    next();
  } catch (error) {
    console.error('❌ [SAME_AGENCY] ERREUR EXCEPTION:', error.message);
    console.error('📋 Stack:', error.stack);
    return errorResponse(res, 500, 'Erreur de vérification d\'agence');
  }
};

/**
 * Raccourcis pour les rôles courants
 */
const requireAdmin = authorize('admin', 'dga', 'adg');
const requireManager = authorize('rm', 'dce');
const requireConseiller = authorize('conseiller');
const requireClient = authorize('client');

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