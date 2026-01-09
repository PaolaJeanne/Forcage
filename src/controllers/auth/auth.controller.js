// src/controllers/auth/auth.controller.js - Authentification (login, refresh token)
const User = require('../../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt.util');
const { successResponse, errorResponse } = require('../../utils/response.util');
const { PERMISSIONS } = require('../../constants/roles');

// Utilitaire pour obtenir les permissions d'un rôle
const getPermissionsForRole = (role) => {
  const permissions = [];
  for (const [permissionName, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (allowedRoles.includes(role)) {
      permissions.push(permissionName);
    }
  }
  if (permissions.includes('VIEW_OWN_DEMANDE')) {
    permissions.push('demandes');
    permissions.push('mesDemandes');
  }
  return permissions;
};

// ============================================
// CONNEXION
// ============================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Email et mot de passe requis');
    }

    const user = await User.findByEmailWithPassword(email);

    if (!user) {
      return errorResponse(res, 401, 'Email ou mot de passe incorrect');
    }

    if (!user.isActive) {
      return errorResponse(res, 403, 'Compte désactivé');
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Email ou mot de passe incorrect');
    }

    // Mettre à jour lastLogin
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Générer tokens
    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      limiteAutorisation: user.limiteAutorisation,
      agence: user.agence,
      agencyId: user.agencyId,
      isActive: user.isActive
    });

    const refreshToken = generateRefreshToken({ userId: user._id });

    console.log('✅ LOGIN SUCCESS:', user.email);

    const permissions = getPermissionsForRole(user.role);

    return successResponse(res, 200, 'Connexion réussie', {
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        permissions,
        agence: user.agence,
        agencyId: user.agencyId,
        limiteAutorisation: user.limiteAutorisation,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
        cni: user.numeroCNI,
        classification: user.classification,
        notationClient: user.notationClient,
        kycValide: user.kycValide,
        listeSMP: user.listeSMP,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return errorResponse(res, 500, 'Erreur lors de la connexion');
  }
};

// ============================================
// REFRESH TOKEN
// ============================================
const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return errorResponse(res, 400, 'Refresh token requis');
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return errorResponse(res, 401, 'Utilisateur non trouvé ou inactif');
    }

    const newToken = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      limiteAutorisation: user.limiteAutorisation,
      agence: user.agence,
      agencyId: user.agencyId,
      isActive: user.isActive
    });

    return successResponse(res, 200, 'Token rafraîchi', {
      token: newToken
    });

  } catch (error) {
    console.error('REFRESH TOKEN ERROR:', error);
    return errorResponse(res, 401, 'Refresh token invalide');
  }
};

module.exports = {
  login,
  refreshTokenHandler
};
