
// ============================================
// 5. CONTROLLER AUTH SÉCURISÉ - src/controllers/auth.controller.js
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
    
    const token = generateToken({ 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    });
    const refreshToken = generateRefreshToken({ userId: user._id });
    
    return successResponse(res, 201, 'Inscription réussie', {
      user: user.toJSON(),
      token,
      refreshToken
    });
    
  } catch (error) {
    logger.error('Erreur inscription:', error);
    return errorResponse(res, 500, 'Erreur lors de l\'inscription');
  }
};

const login = async (req, res) => {
  console.log('🔍 ===== DEBUG LOGIN START =====');
  
  try {
    const { email, password } = req.body;
    
    console.log('📨 Request body received:', req.body);
    console.log('📧 Email extracted:', email);
    console.log('🔑 Password extracted:', password ? '***PRESENT***' : 'MISSING');
    
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return errorResponse(res, 400, 'Email et mot de passe requis');
    }
    
    console.log('🔍 Searching for user...');
    
    // Get user WITH password
    const user = await User.findByEmailWithPassword(email);
    
    console.log('📋 User found:', user ? 'YES' : 'NO');
    
    if (!user) {
      console.log('❌ User not found in database');
      return errorResponse(res, 401, 'Email ou mot de passe incorrect');
    }
    
    console.log('👤 User details:', {
      id: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
    
    if (!user.isActive) {
      console.log('❌ User account is inactive');
      return errorResponse(res, 403, 'Compte désactivé');
    }
    
    console.log('🔄 Calling comparePassword()...');
    
    const isPasswordValid = await user.comparePassword(password);
    
    console.log('✅ comparePassword result:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Password validation failed');
      return errorResponse(res, 401, 'Email ou mot de passe incorrect');
    }
    
    console.log('✅ Password is valid!');
    
    // FIXED: Use updateOne instead of save() to avoid middleware issue
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );
    
    console.log('📝 Generating JWT token...');
    
    const token = generateToken({ 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    });
    const refreshToken = generateRefreshToken({ userId: user._id });
    
    console.log('🎉 Login successful!');
    console.log('🔍 ===== DEBUG LOGIN END =====');
    
    return successResponse(res, 200, 'Connexion réussie', {
      user: user.toJSON(),
      token,
      refreshToken
    });
    
  } catch (error) {
    console.error('🔥 CRITICAL ERROR in login function:');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    
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
    
    const newToken = generateToken({ 
      userId: user._id, 
      email: user.email, 
      role: user.role 
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
    const user = await User.findById(req.userId);
    
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }
    
    return successResponse(res, 200, 'Profil récupéré', {
      user: user.toJSON()
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
    
    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (telephone) user.telephone = telephone;
    
    await user.save();
    
    return successResponse(res, 200, 'Profil mis à jour', {
      user: user.toJSON()
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
    
    logger.info(`Mot de passe changé: ${user.email}`);
    
    return successResponse(res, 200, 'Mot de passe changé avec succès');
    
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