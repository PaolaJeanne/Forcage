// middleware/auth.middleware.js - VERSION COMPLÈTE CORRIGÉE
const { verifyToken, getUserFromToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');
const PermissionHelper = require('../helpers/permission.helper');

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
    console.log('🔑 [AUTHENTICATE] Token (premiers 50 chars):', token.substring(0, 50) + '...');

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
      agence: user.agence,
      agencyId: user.agencyId,
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
      userId: userId,       // Format legacy
      agencyId: user.agencyId || null, // Assurer agencyId est défini
      agence: user.agence || null       // Assurer agence est défini
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
    console.log('🔐 [AUTHORIZE] Vérification des rôles');
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
      agence: req.user.agence,
      agencyId: req.user.agencyId
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

    // Vérifier avec PermissionHelper
    if (PermissionHelper.canAccessDemande(req.user, demande)) {
      req.demande = demande;
      return next();
    }

    return errorResponse(res, 403, 'Accès non autorisé à cette demande');

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
 * Middleware pour traiter une demande
 */
const canProcessDemande = async (req, res, next) => {
  try {
    const DemandeForçage = require('../models/DemandeForçage');
    const demande = await DemandeForçage.findById(req.params.id);

    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }

    // Vérifier avec PermissionHelper
    if (PermissionHelper.canValidateDemande(req.user, demande)) {
      req.demande = demande;
      return next();
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

      case 'EN_ETUDE_CONSEILLER':
        if (['rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      case 'EN_ATTENTE_RM':
        if (['dce', 'adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      case 'EN_ATTENTE_DCE':
        if (['adg', 'dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      case 'EN_ATTENTE_ADG':
        if (['dga', 'admin', 'risques'].includes(req.user.role)) {
          return next();
        }
        break;

      case 'EN_ANALYSE_RISQUES':
        if (['risques', 'adg', 'dga', 'admin'].includes(req.user.role)) {
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
  
  // Vérifier avec PermissionHelper
  if (!PermissionHelper.canAuthorizeMontant(req.user.role, montant)) {
    console.error('❌ checkAmountLimit: Limite dépassée');
    const limite = require('../constants/roles').LIMITES_AUTORISATION[req.user.role] || 0;
    return errorResponse(
      res,
      403,
      `Montant (${montant} FCFA) dépasse votre limite d'autorisation (${limite} FCFA)`
    );
  }

  console.log('✅ checkAmountLimit: Limite respectée');
  next();
}

/**
 * Vérifier si l'utilisateur est dans la même agence
 * VERSION CORRIGÉE avec support agencyId/agence
 */
const sameAgency = async (req, res, next) => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🏢 [SAME_AGENCY] Vérification agence');
    console.log('📍 Route:', req.method, req.path);
    console.log('👤 [SAME_AGENCY] Rôle utilisateur:', req.user.role);
    console.log('🏢 [SAME_AGENCY] Agence utilisateur:', req.user.agence);
    console.log('🏢 [SAME_AGENCY] AgencyId utilisateur:', req.user.agencyId);

    // Les rôles supérieurs ont accès à tout
    if (['admin', 'dga', 'risques'].includes(req.user.role)) {
      console.log('✅ [SAME_AGENCY] Rôle supérieur - Accès complet');
      console.log('='.repeat(80) + '\n');
      return next();
    }

    const demandeId = req.params.id || req.body.demandeId;
    console.log('📋 [SAME_AGENCY] Demande ID:', demandeId);
    
    if (!demandeId) {
      console.error('❌ [SAME_AGENCY] ERREUR: ID demande manquant');
      return errorResponse(res, 400, 'ID demande requis');
    }
    
    const DemandeForçage = require('../models/DemandeForçage');

    const demande = await DemandeForçage.findById(demandeId)
      .populate('clientId', 'agence agencyId')
      .populate('agencyId', 'name');

    if (!demande) {
      console.error('❌ [SAME_AGENCY] ERREUR: Demande introuvable');
      console.log('📋 Demande ID:', demandeId);
      console.log('='.repeat(80) + '\n');
      return errorResponse(res, 404, 'Demande introuvable');
    }

    console.log('📋 [SAME_AGENCY] Demande trouvée:', {
      id: demande._id,
      agence: demande.agence || demande.clientId?.agence,
      agencyId: demande.agencyId?._id || demande.clientId?.agencyId
    });

    // Vérification par agencyId (préféré)
    if (req.user.agencyId && demande.agencyId) {
      const sameAgencyById = demande.agencyId.toString() === req.user.agencyId.toString();
      if (sameAgencyById) {
        console.log('✅ [SAME_AGENCY] AgencyId correspond - Accès accordé');
        console.log('='.repeat(80) + '\n');
        return next();
      }
    }

    // Vérification par nom d'agence (fallback)
    const userAgence = req.user.agence;
    const demandeAgence = demande.agence || demande.clientId?.agence;
    
    if (userAgence && demandeAgence && userAgence === demandeAgence) {
      console.log('✅ [SAME_AGENCY] Nom d\'agence correspond - Accès accordé');
      console.log('='.repeat(80) + '\n');
      return next();
    }

    console.error('❌ [SAME_AGENCY] ERREUR: Agence différente');
    console.log('📋 Agence utilisateur:', userAgence);
    console.log('📋 Agence demande:', demandeAgence);
    console.log('📋 AgencyId utilisateur:', req.user.agencyId);
    console.log('📋 AgencyId demande:', demande.agencyId?._id);
    console.log('='.repeat(80) + '\n');
    return errorResponse(res, 403, 'Accès refusé - Agence différente');

  } catch (error) {
    console.error('❌ [SAME_AGENCY] ERREUR EXCEPTION:', error.message);
    console.error('📋 Stack:', error.stack);
    return errorResponse(res, 500, 'Erreur de vérification d\'agence');
  }
};

/**
 * Middleware pour vérifier les permissions spécifiques
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 401, 'Non authentifié');
    }

    if (!PermissionHelper.hasPermission(req.user.role, permission)) {
      return errorResponse(
        res,
        403,
        `Permission refusée. Vous devez avoir la permission: ${permission}`
      );
    }

    next();
  };
};

/**
 * Raccourcis pour les rôles courants
 */
const requireAdmin = authorize('admin', 'dga', 'adg');
const requireManager = authorize('rm', 'dce');
const requireConseiller = authorize('conseiller');
const requireClient = authorize('client');
const requireRisques = authorize('risques');

module.exports = {
  authenticate,
  authorize,
  canAuthorize,
  sameAgency,
  requirePermission,
  requireAdmin,
  requireManager,
  requireConseiller,
  requireClient,
  requireRisques,
  canViewDemande,
  canCreateDemande,
  canProcessDemande,
  requireNextLevel
};