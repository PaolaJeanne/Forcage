

// ============================================
// 6. CONTROLLER ADMIN - src/controllers/admin.controller.js
// ============================================
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');

const createUser = async (req, res) => {
  try {
    const { 
      nom, prenom, email, password, telephone, 
      role, numeroCompte, agence, limiteAutorisation,
      classification, notationClient, kycValide 
    } = req.body;
    
    if (role === 'admin' && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Seul un admin peut créer un autre admin');
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }
    
    const rolesAutorises = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
    if (!rolesAutorises.includes(role)) {
      return errorResponse(res, 400, 'Rôle invalide');
    }
    
    if (['conseiller', 'rm', 'dce'].includes(role) && !agence) {
      return errorResponse(res, 400, 'L\'agence est requise pour ce rôle');
    }
    
    if (role === 'client' && !numeroCompte) {
      return errorResponse(res, 400, 'Le numéro de compte est requis pour un client');
    }
    
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
    
    logger.info(`Utilisateur créé par admin: ${email} (role: ${role})`);
    
    return successResponse(res, 201, 'Utilisateur créé', {
      user: user.toJSON()
    });
    
  } catch (error) {
    logger.error('Erreur création utilisateur:', error);
    return errorResponse(res, 500, 'Erreur lors de la création');
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, limiteAutorisation, agence } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }
    
    if (userId === req.userId.toString()) {
      return errorResponse(res, 403, 'Vous ne pouvez pas modifier votre propre rôle');
    }
    
    const rolesAutorises = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
    if (role && !rolesAutorises.includes(role)) {
      return errorResponse(res, 400, 'Rôle invalide');
    }
    
    if (role) user.role = role;
    if (limiteAutorisation !== undefined) user.limiteAutorisation = limiteAutorisation;
    if (agence) user.agence = agence;
    
    user.updatedBy = req.userId;
    await user.save();
    
    logger.info(`Rôle modifié: ${user.email} -> ${role}`);
    
    return successResponse(res, 200, 'Rôle mis à jour', {
      user: user.toJSON()
    });
    
  } catch (error) {
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { role, agence, isActive, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (agence) filter.agence = agence;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const users = await User.find(filter)
      .select('-password -otpSecret')
      .limit(parseInt(limit))
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(filter);
    
    return successResponse(res, 200, 'Utilisateurs récupérés', {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

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
    
    logger.info(`Statut modifié: ${user.email} -> ${user.isActive ? 'actif' : 'inactif'}`);
    
    return successResponse(res, 200, `Utilisateur ${user.isActive ? 'activé' : 'désactivé'}`, {
      user: user.toJSON()
    });
    
  } catch (error) {
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

module.exports = {
  createUser,
  updateUserRole,
  getAllUsers,
  toggleUserStatus
};
