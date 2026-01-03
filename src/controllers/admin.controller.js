// ============================================
// CONTROLLER ADMIN OPTIMISÉ - src/controllers/admin.controller.js
// ============================================
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// Création d'utilisateur avec réponse optimisée
const createUser = async (req, res) => {
  try {
    logger.header('CREATE USER', '👤');
    logger.request('POST', '/admin/users', req.user);
    
    const {
      nom, prenom, email, password, telephone,
      role, numeroCompte, agence, limiteAutorisation,
      classification, notationClient, kycValide
    } = req.body;
    
    logger.debug('Request body:', { nom, prenom, email, role, agence });

    // Vérifier les permissions
    if (role === 'admin' && req.user.role !== 'admin') {
      logger.permission(false, 'create_admin', req.user);
      logger.footer();
      return errorResponse(res, 403, 'Seul un admin peut créer un autre admin');
    }

    // Vérifier l'email existant
    logger.database('FIND', 'User', { email });
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Email already exists', { email });
      logger.footer();
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    // Validation des rôles
    const rolesAutorises = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
    logger.validation('role', rolesAutorises.includes(role), `Role: ${role}`);
    if (!rolesAutorises.includes(role)) {
      logger.footer();
      return errorResponse(res, 400, 'Rôle invalide');
    }

    // Validation des champs requis
    if (['conseiller', 'rm', 'dce'].includes(role) && !agence) {
      logger.validation('agence_required', false, `Role ${role} requires agence`);
      logger.footer();
      return errorResponse(res, 400, 'L\'agence est requise pour ce rôle');
    }

    if (role === 'client' && !numeroCompte) {
      logger.validation('numeroCompte_required', false, 'Client requires numeroCompte');
      logger.footer();
      return errorResponse(res, 400, 'Le numéro de compte est requis pour un client');
    }

    // Créer l'utilisateur
    logger.info('Creating new user', { email, role, agence });
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
    logger.database('CREATE', 'User', { id: user._id, email: user.email });

    // RÉPONSE OPTIMISÉE: Renvoyer seulement l'essentiel
    logger.success('User created successfully', { id: user._id, email: user.email });
    logger.response(201, 'Utilisateur créé avec succès');
    logger.footer();
    
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
    logger.error('Error creating user', error);
    logger.footer();
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

// Récupérer tous les clients (utilisateurs avec role='client')
const getAllClients = async (req, res) => {
  try {
    logger.header('GET ALL CLIENTS', '👥');
    logger.request('GET', '/admin/clients', req.user);
    
    const { isActive, page = 1, limit = 20 } = req.query;
    logger.debug('Query params:', { isActive, page, limit });

    const filter = { role: 'client' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    logger.database('FIND', 'User', filter);
    
    // OPTIMISATION: Sélectionner seulement les champs nécessaires
    const clients = await User.find(filter)
      .select('email nom prenom role agence isActive limiteAutorisation notationClient numeroCompte createdAt lastLogin')
      .limit(parseInt(limit))
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);
    
    logger.success(`Found ${clients.length} clients`, { total, page, limit });

    // OPTIMISATION: Structure de réponse légère
    const response = {
      clients: clients.map(client => ({
        id: client._id,
        email: client.email,
        nom: client.nom,
        prenom: client.prenom,
        role: client.role,
        agence: client.agence,
        isActive: client.isActive,
        limiteAutorisation: client.limiteAutorisation,
        notationClient: client.notationClient,
        numeroCompte: client.numeroCompte,
        lastLogin: client.lastLogin,
        createdAt: client.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
    
    logger.response(200, 'Clients récupérés');
    logger.footer();
    
    return successResponse(res, 200, 'Clients récupérés', response);

  } catch (error) {
    logger.error('Error fetching clients', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Récupérer toutes les agences
 */
const getAgences = async (req, res) => {
  try {
    logger.header('GET AGENCES', '🏢');
    logger.request('GET', '/admin/agences', req.user);
    
    const Agency = require('../models/Agency');
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    logger.debug('Query params:', { page, limit, search });

    // Construire la query
    let query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { region: { $regex: search, $options: 'i' } }
      ];
      logger.debug('Search filter applied', { search });
    }

    logger.database('FIND', 'Agency', query);
    
    // Récupérer les agences
    const [agences, total] = await Promise.all([
      Agency.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Agency.countDocuments(query)
    ]);

    logger.success(`Found ${agences.length} agences`, { total, page, limit });

    const response = {
      agences: agences.map(agence => ({
        id: agence._id,
        nom: agence.name,
        description: agence.description,
        region: agence.region,
        ville: agence.city,
        adresse: agence.address,
        telephone: agence.phone,
        email: agence.email,
        totalConseillers: agence.conseillers ? agence.conseillers.length : 0,
        totalResponsables: agence.responsables ? agence.responsables.length : 0,
        isActive: agence.isActive,
        createdAt: agence.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
    
    logger.response(200, 'Agences récupérées');
    logger.footer();

    return successResponse(res, 200, 'Agences récupérées', response);

  } catch (error) {
    logger.error('Error fetching agences', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur', { details: error.message });
  }
};

module.exports = {
  createUser,
  updateUserRole,
  getAllUsers,
  getAllClients,
  toggleUserStatus,
  getUserById,
  deleteUser,
  getAgences
};
