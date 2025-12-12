const { User } = require('../models');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');

// Inscription
const register = async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, numeroCompte, role } = req.body;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }
    
    // Créer l'utilisateur
    const user = new User({
      nom,
      prenom,
      email,
      password,
      telephone,
      numeroCompte,
      role: role || 'client'
    });
    
    await user.save();
    
    logger.info(`Nouvel utilisateur créé: ${email}`);
    return successResponse(res, 201, 'Utilisateur créé avec succès', {
      user: user.toJSON()
    });
    } catch (error) {
    logger.error('Erreur lors de l\'inscription:', error);
    return errorResponse(res, 500, 'Erreur lors de l\'inscription', error.message);
  }
};

// Connexion
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérifier les champs requis
    if (!email || !password) {
      return errorResponse(res, 400, 'Email et mot de passe requis');
    }
    
    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return errorResponse(res, 401, 'Email ou mot de passe incorrect');
    }
    
    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      return errorResponse(res, 403, 'Compte désactivé');
    }
    
    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Email ou mot de passe incorrect');
    }
    
    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();
    
    logger.info(`Connexion réussie: ${email}`);
    
    // Générer les tokens
    const access_token = generateToken({ userId: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });
    
    return successResponse(res, 200, 'Connexion réussie', {
      user: user.toJSON(),
      access_token,
      refreshToken
    });
    
  } catch (error) {
    logger.error('Erreur lors de la connexion:', error);
    return errorResponse(res, 500, 'Erreur lors de la connexion', error.message);
  }
};

// Rafraîchir le token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return errorResponse(res, 400, 'Refresh token requis');
    }
    
    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Récupérer l'utilisateur
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return errorResponse(res, 401, 'Utilisateur non trouvé ou inactif');
    }
    
    // Générer un nouveau token
    const newToken = generateToken({ userId: user._id, email: user.email, role: user.role });
    
    return successResponse(res, 200, 'Token rafraîchi', {
      token: newToken
    });
    
  } catch (error) {
    logger.error('Erreur lors du rafraîchissement du token:', error);
    return errorResponse(res, 401, 'Refresh token invalide ou expiré');
  }
};

// Récupérer le profil de l'utilisateur connecté
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }
    
    return successResponse(res, 200, 'Profil récupéré', {
      user: user.toJSON()
    });
    
  } catch (error) {
    logger.error('Erreur lors de la récupération du profil:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};

// Mettre à jour le profil
const updateProfile = async (req, res) => {
  try {
    const { nom, prenom, telephone } = req.body;
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }
    
    // Mettre à jour les champs autorisés
    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (telephone) user.telephone = telephone;
    
    await user.save();
    
    logger.info(`Profil mis à jour: ${user.email}`);
    
    return successResponse(res, 200, 'Profil mis à jour', {
      user: user.toJSON()
    });
    
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du profil:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};

// Changer le mot de passe
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
    
    // Vérifier l'ancien mot de passe
    const isPasswordValid = await user.comparePassword(oldPassword);
    
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Ancien mot de passe incorrect');
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();
    
    logger.info(`Mot de passe changé: ${user.email}`);
    
    return successResponse(res, 200, 'Mot de passe changé avec succès');
    
  } catch (error) {
    logger.error('Erreur lors du changement de mot de passe:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
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