// ============================================
// CONTROLLER ADMIN OPTIMISÉ - src/controllers/admin.controller.js
// ============================================
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response.util');

// Création d'utilisateur avec réponse optimisée
const createUser = async (req, res) => {
  try {
    const {
      nom, prenom, email, password, telephone,
      role, numeroCompte, agence, limiteAutorisation,
      classification, notationClient, kycValide
    } = req.body;

    // Vérifier les permissions
    if (role === 'admin' && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Seul un admin peut créer un autre admin');
    }

    // Vérifier l'email existant
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    // Validation des rôles
    const rolesAutorises = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
    if (!rolesAutorises.includes(role)) {
      return errorResponse(res, 400, 'Rôle invalide');
    }

    // Validation des champs requis
    if (['conseiller', 'rm', 'dce'].includes(role) && !agence) {
      return errorResponse(res, 400, 'L\'agence est requise pour ce rôle');
    }

    if (role === 'client' && !numeroCompte) {
      return errorResponse(res, 400, 'Le numéro de compte est requis pour un client');
    }

    // Créer l'utilisateur
    const user = new User({
      nom,
      prenom,
      email,
      password,
      telephone,
      role,
      numeroCompte,
      agence,
      limiteAutorisation: limiteAutorisation || 0,
      classification: classification || 'normal',
      notationClient: notationClient || 'C',
      kycValide: kycValide || false,
      createdBy: req.userId
    });

    await user.save();

    // RÉPONSE OPTIMISÉE: Renvoyer seulement l'essentiel
    return successResponse(res, 201, 'Utilisateur créé avec succès', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    return errorResponse(res, 500, 'Erreur lors de la création');
  }
};

// Mise à jour du rôle avec réponse optimisée
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, limiteAutorisation, agence } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    // Empêcher de modifier son propre rôle
    if (userId === req.userId.toString()) {
      return errorResponse(res, 403, 'Vous ne pouvez pas modifier votre propre rôle');
    }

    // Validation du rôle
    const rolesAutorises = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
    if (role && !rolesAutorises.includes(role)) {
      return errorResponse(res, 400, 'Rôle invalide');
    }

    // Mise à jour
    if (role) user.role = role;
    if (limiteAutorisation !== undefined) user.limiteAutorisation = limiteAutorisation;
    if (agence) user.agence = agence;

    user.updatedBy = req.userId;
    await user.save();

    // RÉPONSE OPTIMISÉE
    return successResponse(res, 200, 'Rôle mis à jour avec succès', {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        limiteAutorisation: user.limiteAutorisation,
        agence: user.agence,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    return errorResponse(res, 500, 'Erreur lors de la mise à jour');
  }
};

// Liste des utilisateurs avec pagination optimisée
const getAllUsers = async (req, res) => {
  try {
    const { role, agence, isActive, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (agence) filter.agence = agence;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // OPTIMISATION: Sélectionner seulement les champs nécessaires
    const users = await User.find(filter)
      .select('email nom prenom role agence isActive limiteAutorisation createdAt lastLogin')
      .limit(parseInt(limit))
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    // OPTIMISATION: Structure de réponse légère
    return successResponse(res, 200, 'Utilisateurs récupérés', {
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        isActive: user.isActive,
        limiteAutorisation: user.limiteAutorisation,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// Activation/désactivation avec réponse optimisée
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    if (userId === req.userId.toString()) {
      return errorResponse(res, 403, 'Vous ne pouvez pas modifier votre propre statut');
    }

    user.isActive = !user.isActive;
    user.updatedBy = req.userId;
    await user.save();

    // RÉPONSE OPTIMISÉE
    return successResponse(res, 200, `Utilisateur ${user.isActive ? 'activé' : 'désactivé'}`, {
      user: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// Récupérer un utilisateur spécifique (pour admin)
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password -otpSecret -__v');

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    return successResponse(res, 200, 'Utilisateur récupéré', {
      user: user.toJSON()
    });

  } catch (error) {
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// Suppression d'utilisateur
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[DEBUG] Tentative suppression utilisateur: ${userId}`);
    
    // Logique temporaire
    return res.status(200).json({
      success: true,
      message: 'Fonction deleteUser en développement',
      userId
    });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

module.exports = {
  createUser,
  updateUserRole,
  getAllUsers,
  toggleUserStatus,
  getUserById,
  deleteUser
};
