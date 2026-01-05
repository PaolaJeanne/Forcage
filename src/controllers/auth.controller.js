// src/controllers/auth.controller.js - VERSION CORRIGÉE FINALE
const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { successResponse, errorResponse } = require('../utils/response.util');
const { PERMISSIONS } = require('../constants/roles');
const NotificationService = require('../services/notification.service');

// Utilitaire pour obtenir les permissions d'un rôle
const getPermissionsForRole = (role) => {
  const permissions = [];
  for (const [permissionName, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (allowedRoles.includes(role)) {
      permissions.push(permissionName);
    }
  }
  // Ajouter des permissions implicites ou frontend-specific si nécessaire
  if (permissions.includes('VIEW_OWN_DEMANDE')) {
    permissions.push('demandes'); // Alias pour compatibilité frontend
    permissions.push('mesDemandes'); // Alias pour compatibilité frontend
  }
  return permissions;
};

// ============================================
// INSCRIPTION
// ============================================
const register = async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, numeroCompte, cni } = req.body;

    console.log('REGISTER ATTEMPT:', { nom, prenom, email, telephone, numeroCompte, cni });

    // Validation détaillée
    const missingFields = [];
    if (!nom) missingFields.push('nom');
    if (!prenom) missingFields.push('prenom');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');

    if (missingFields.length > 0) {
      return errorResponse(res, 400, `Champs obligatoires manquants: ${missingFields.join(', ')}`);
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'Le mot de passe doit contenir au moins 6 caractères');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    const user = new User({
      nom,
      prenom,
      email,
      password,
      telephone,
      numeroCompte,
      cni, // ✅ AJOUTÉ
      role: 'client',
      limiteAutorisation: 0,
      classification: 'normal',
      notationClient: 'C',
      kycValide: false,
      agence: null, // Clients n'ont pas d'agence
      agencyId: null // Clients n'ont pas d'agence
    });

    await user.save();

    // ✅ Envoyer une notification de bienvenue
    try {
      await NotificationService.createNotification({
        utilisateur: user._id,
        type: 'SYSTEME',
        titre: 'Bienvenue sur CreditApp',
        message: `Bienvenue ${user.prenom} ! Votre compte a été créé avec succès.`,
        priorite: 'MOYENNE',
        categorie: 'Alerte'
      });
    } catch (notificationError) {
      console.error('⚠️ Erreur notification bienvenue:', notificationError);
    }

    return successResponse(res, 201, 'Inscription réussie', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
        cni: user.cni // ✅ AJOUTÉ
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);
    return errorResponse(res, 500, 'Erreur lors de l\'inscription');
  }
};

// ============================================
// CONNEXION - VERSION CORRIGÉE
// Retourne token + user pour le frontend
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
      agencyId: user.agencyId, // Ajouté
      isActive: user.isActive
    });

    const refreshToken = generateRefreshToken({ userId: user._id });

    console.log('✅ LOGIN SUCCESS:', user.email);

    // Obtenir les permissions
    const permissions = getPermissionsForRole(user.role);

    // ✅ CORRECTION: Retourner token + refreshToken + user + permissions
    return successResponse(res, 200, 'Connexion réussie', {
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        permissions, // Ajout des permissions explicites
        agence: user.agence,
        agencyId: user.agencyId, // Ajouté
        limiteAutorisation: user.limiteAutorisation,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
        cni: user.cni, // ✅ AJOUTÉ
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
// GET PROFILE
// ============================================
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    const permissions = getPermissionsForRole(user.role);

    return successResponse(res, 200, 'Profil récupéré', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        permissions, // Ajout des permissions
        agence: user.agence,
        agencyId: user.agencyId, // Ajouté
        limiteAutorisation: user.limiteAutorisation,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
        cni: user.cni, // ✅ AJOUTÉ
        classification: user.classification,
        notationClient: user.notationClient,
        kycValide: user.kycValide,
        dateKyc: user.dateKyc,
        listeSMP: user.listeSMP,
        soldeActuel: user.soldeActuel,
        decouvertAutorise: user.decouvertAutorise,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('GET PROFILE ERROR:', error);
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// ============================================
// REFRESH TOKEN
// ============================================
const refreshToken = async (req, res) => {
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
      agencyId: user.agencyId, // Ajouté
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

// ============================================
// UPDATE PROFILE
// ============================================
const updateProfile = async (req, res) => {
  try {
    const { nom, prenom, telephone } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (telephone) user.telephone = telephone;

    await user.save();

    console.log('✅ PROFILE UPDATED:', user.email);

    return successResponse(res, 200, 'Profil mis à jour', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('UPDATE PROFILE ERROR:', error);
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// ============================================
// CHANGE PASSWORD
// ============================================
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return errorResponse(res, 400, 'Ancien et nouveau mot de passe requis');
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 400, 'Le nouveau mot de passe doit contenir au moins 6 caractères');
    }

    const user = await User.findById(req.userId).select('+password');

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    const isPasswordValid = await user.comparePassword(oldPassword);

    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Ancien mot de passe incorrect');
    }

    user.password = newPassword;
    await user.save();

    // ✅ Envoyer une notification de changement de mot de passe
    try {
      await NotificationService.createNotification({
        utilisateur: user._id,
        type: 'SECURITE',
        titre: 'Sécurité : Mot de passe modifié',
        message: 'Votre mot de passe a été modifié avec succès. Si vous n\'êtes pas à l\'origine de cette action, veuillez contacter le support.',
        priorite: 'HAUTE',
        categorie: 'Alerte'
      });
    } catch (notificationError) {
      console.error('⚠️ Erreur notification mot de passe:', notificationError);
    }

    console.log('✅ PASSWORD CHANGED:', user.email);

    const newToken = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      limiteAutorisation: user.limiteAutorisation,
      agence: user.agence,
      agencyId: user.agencyId, // Ajouté
      isActive: user.isActive
    });

    return successResponse(res, 200, 'Mot de passe changé avec succès', {
      token: newToken
    });

  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error);
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword
};