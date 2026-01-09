// src/controllers/user/profile.controller.js - Gestion du profil utilisateur
const User = require('../../models/User');
const { successResponse, errorResponse } = require('../../utils/response.util');
const { PERMISSIONS } = require('../../constants/roles');
const NotificationService = require('../../services/notification.service');

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

    const { generateToken } = require('../../utils/jwt.util');
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

    return successResponse(res, 200, 'Mot de passe changé avec succès', {
      token: newToken
    });

  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error);
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword
};
