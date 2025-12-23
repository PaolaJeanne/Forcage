// src/controllers/auth.controller.js
const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { successResponse, errorResponse } = require('../utils/response.util');


// ============================================
// INSCRIPTION - Retourne uniquement l'utilisateur
// ============================================
const register = async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, numeroCompte } = req.body;

    // Validation
    if (!nom || !prenom || !email || !password) {
      return errorResponse(res, 400, 'Tous les champs obligatoires requis');
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'Le mot de passe doit contenir au moins 6 caractères');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    // Rôle client forcé
    const user = new User({
      nom,
      prenom,
      email,
      password,
      telephone,
      numeroCompte,
      role: 'client', // ← FORCÉ
      limiteAutorisation: 0,
      classification: 'normal',
      notationClient: 'C',
      kycValide: false
    });

    await user.save();



    // OPTIMISATION: À l'inscription, on ne retourne QUE l'utilisateur
    return successResponse(res, 201, 'Inscription réussie', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte
      }
      // PAS de token ni refreshToken ici
    });

  } catch (error) {

    return errorResponse(res, 500, 'Erreur lors de l\'inscription');
  }
};

// ============================================
// CONNEXION - Retourne uniquement les tokens
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
      isActive: user.isActive
    });

    const refreshToken = generateRefreshToken({ userId: user._id });



    // OPTIMISATION: À la connexion, on ne retourne QUE les tokens
    return successResponse(res, 200, 'Connexion réussie', {
      token,
      refreshToken
      // PAS d'infos utilisateur ici
    });

  } catch (error) {

    return errorResponse(res, 500, 'Erreur lors de la connexion');
  }
};

// ============================================
// GET PROFILE - Pour récupérer les infos utilisateur
// ============================================
const getProfile = async (req, res) => {
  try {
    // Récupérer les infos complètes de l'utilisateur
    const user = await User.findById(req.userId)
      .select('telephone numeroCompte classification notationClient kycValide dateKyc listeSMP soldeActuel decouvertAutorise');

    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    // Retourner toutes les infos utilisateur
    return successResponse(res, 200, 'Profil récupéré', {
      user: {
        id: req.userId,
        email: req.user?.email || user.email,
        nom: req.user?.nom || user.nom,
        prenom: req.user?.prenom || user.prenom,
        role: req.user?.role || user.role,
        agence: req.user?.agence || user.agence,
        limiteAutorisation: req.user?.limiteAutorisation || user.limiteAutorisation,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
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
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// ============================================
// REMAINING FUNCTIONS (unchanged)
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
      isActive: user.isActive
    });

    return successResponse(res, 200, 'Token rafraîchi', {
      token: newToken
    });

  } catch (error) {
    return errorResponse(res, 401, 'Refresh token invalide');
  }
};

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

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

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



    const newToken = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      limiteAutorisation: user.limiteAutorisation,
      agence: user.agence,
      isActive: user.isActive
    });

    return successResponse(res, 200, 'Mot de passe changé avec succès', {
      token: newToken
    });

  } catch (error) {

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