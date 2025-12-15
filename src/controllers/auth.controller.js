// ============================================
// CONTROLLER AUTH OPTIMISÉ - src/controllers/auth.controller.js
// ============================================
const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');

// ⚠️ INSCRIPTION - ROLE CLIENT FORCÉ
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
    
    // ⚠️ SÉCURITÉ: Rôle client forcé, on ignore req.body.role
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
    
    logger.info(`Nouvel utilisateur: ${email} (role: client)`);
    
    // OPTIMISATION: Générer token avec plus d'infos
    const token = generateToken({ 
      userId: user._id, 
      email: user.email, 
      role: user.role,
      nom: user.nom,
      prenom: user.prenom
    });
    
    const refreshToken = generateRefreshToken({ userId: user._id });
    
    // OPTIMISATION: Réponse légère - seulement l'essentiel
    return successResponse(res, 201, 'Inscription réussie', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte
      },
      token,
      refreshToken
    });
    
  } catch (error) {
    logger.error('Erreur inscription:', error);
    return errorResponse(res, 500, 'Erreur lors de l\'inscription');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return errorResponse(res, 400, 'Email et mot de passe requis');
    }
    
    // OPTIMISATION: Utiliser la méthode statique du modèle
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
    
    // Mettre à jour lastLogin sans déclencher le middleware
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );
    
    // OPTIMISATION: Générer token avec toutes les infos nécessaires
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
    
    logger.info(`Connexion: ${email} (role: ${user.role})`);
    
    // OPTIMISATION: Réponse légère - le token contient déjà nom, prenom, role, etc.
    return successResponse(res, 200, 'Connexion réussie', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        // Seulement ce qui n'est pas dans le token
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
        agence: user.agence,
        limiteAutorisation: user.limiteAutorisation
      },
      token,
      refreshToken
    });
    
  } catch (error) {
    logger.error('Erreur connexion:', error);
    return errorResponse(res, 500, 'Erreur lors de la connexion');
  }
};

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
    
    // OPTIMISATION: Générer nouveau token avec toutes les infos
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

const getProfile = async (req, res) => {
  try {
    // OPTIMISATION: Récupérer seulement les infos non présentes dans le token
    const user = await User.findById(req.userId)
      .select('telephone numeroCompte classification notationClient kycValide dateKyc listeSMP soldeActuel decouvertAutorise');
    
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }
    
    // OPTIMISATION: Combiner les infos du token (req.user) avec celles de la DB
    return successResponse(res, 200, 'Profil récupéré', {
      user: {
        // Depuis le token (déjà dans req.user si middleware optimisé)
        id: req.userId,
        email: req.user?.email || user.email,
        nom: req.user?.nom || user.nom,
        prenom: req.user?.prenom || user.prenom,
        role: req.user?.role || user.role,
        agence: req.user?.agence || user.agence,
        limiteAutorisation: req.user?.limiteAutorisation || user.limiteAutorisation,
        // Depuis la base de données
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

const updateProfile = async (req, res) => {
  try {
    const { nom, prenom, telephone } = req.body;
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }
    
    // Mettre à jour
    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (telephone) user.telephone = telephone;
    
    await user.save();
    
    logger.info(`Profil mis à jour: ${user.email}`);
    
    // OPTIMISATION: Réponse légère après mise à jour
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
    logger.error('Erreur mise à jour profil:', error);
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
    
    logger.info(`Mot de passe changé: ${user.email}`);
    
    // OPTIMISATION: Générer un nouveau token après changement de mot de passe
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
    logger.error('Erreur changement mot de passe:', error);
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