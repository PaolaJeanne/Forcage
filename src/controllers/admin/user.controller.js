// src/controllers/admin/user.controller.js - Gestion des utilisateurs (Admin seulement)
const User = require('../../models/User');
const Agency = require('../../models/Agency');
const { successResponse, errorResponse } = require('../../utils/response.util');

// ============================================
// CRÉATION D'UTILISATEUR (Admin seulement)
// ============================================
const createUser = async (req, res) => {
  try {
    console.log('📝 [ADMIN CREATE USER] Début - Données reçues:', req.body);
    const {
      nom, prenom, email, password, telephone,
      role, numeroCompte, agence, limiteAutorisation,
      classification, notationClient, kycValide
    } = req.body;

    // Validation des champs requis
    const errors = [];
    if (!nom || nom.trim() === '') {
      errors.push('Le nom est requis');
    }
    if (!prenom || prenom.trim() === '') {
      errors.push('Le prénom est requis');
    }
    if (!email || email.trim() === '') {
      errors.push('L\'email est requis');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.push('Email invalide');
    }
    if (!password || password.trim() === '') {
      errors.push('Le mot de passe est requis');
    }
    if (!telephone || telephone.trim() === '') {
      errors.push('Le téléphone est requis');
    }
    if (!role || role.trim() === '') {
      errors.push('Le rôle est requis');
    } else {
      const validRoles = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
      if (!validRoles.includes(role)) {
        errors.push(`Rôle invalide. Rôles valides: ${validRoles.join(', ')}`);
      }
    }

    // Validation spécifique par rôle
    if (role === 'client' && (!numeroCompte || numeroCompte.trim() === '')) {
      errors.push('Le numéro de compte est requis pour un client');
    }

    let agencyId = null;
    let agencyName = null;
    if (['conseiller', 'rm', 'dce', 'adg', 'risques'].includes(role)) {
      if (!agence || agence.trim() === '') {
        errors.push(`L'agence est requise pour le rôle ${role}`);
      } else {
        // Vérifier si l'agence existe
        const agency = await Agency.findOne({
          $or: [{ name: agence.trim() }, { code: agence.trim() }],
          isActive: true
        });
        if (!agency) {
          errors.push(`L'agence "${agence}" n'existe pas ou est inactive`);
        } else {
          agencyId = agency._id;
          agencyName = agency.name;
        }
      }
    }

    if (errors.length > 0) {
      console.log('❌ Erreurs de validation:', errors);
      return errorResponse(res, 400, 'Erreur de validation', { errors });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    // Créer l'utilisateur
    const user = new User({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      telephone: telephone.trim(),
      role: role.trim(),
      numeroCompte: numeroCompte ? numeroCompte.trim() : undefined,
      agence: agencyName,
      agencyId: agencyId,
      limiteAutorisation: limiteAutorisation || 0,
      classification: classification || 'normal',
      notationClient: notationClient || 'C',
      kycValide: kycValide || false,
      isActive: true,
      createdBy: req.userId
    });

    await user.save();

    console.log('✅ Utilisateur créé avec succès:', user.email);

    return successResponse(res, 201, 'Utilisateur créé avec succès', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        agencyId: user.agencyId,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('🔥 ERREUR création utilisateur:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return errorResponse(res, 400, 'Erreur de validation des données', { errors: messages });
    }
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Cette adresse email est déjà utilisée');
    }
    return errorResponse(res, 500, 'Erreur lors de la création');
  }
};

// ============================================
// LISTE DES UTILISATEURS (Admin)
// ============================================
const getAllUsers = async (req, res) => {
  try {
    const { role, agence, isActive, page = 1, limit = 20 } = req.query;

    // Construire le filtre
    const filter = {};
    if (role) filter.role = role;
    if (agence) filter.agence = agence;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Récupérer les utilisateurs (SANS conseillerAssigné)
    const users = await User.find(filter)
      .select('email nom prenom role agence isActive limiteAutorisation createdAt')
      .limit(parseInt(limit))
      .skip(((parseInt(page) || 1) - 1) * (parseInt(limit) || 20))
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(filter);

    return successResponse(res, 200, 'Utilisateurs récupérés', {
      users: users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        isActive: user.isActive,
        limiteAutorisation: user.limiteAutorisation,
        createdAt: user.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        pages: Math.ceil(total / (parseInt(limit) || 20))
      }
    });

  } catch (error) {
    console.error('🔥 ERREUR récupération utilisateurs:', error);
    return errorResponse(res, 500, 'Erreur lors de la récupération des utilisateurs');
  }
};

// ============================================
// LISTE DES CLIENTS AVEC CONSEILLER ASSIGNÉ
// ============================================
const getAllClients = async (req, res) => {
  try {
    const { agence, isActive, page = 1, limit = 20 } = req.query;

    // Construire le filtre (seulement les clients)
    const filter = { role: 'client' };
    if (agence) filter.agence = agence;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Récupérer les clients avec leur conseiller assigné
    const clients = await User.find(filter)
      .select('email nom prenom role agence agencyId isActive limiteAutorisation notationClient classification conseillerAssigné createdAt')
      .populate('conseillerAssigné', 'nom prenom email telephone')
      .limit(parseInt(limit))
      .skip(((parseInt(page) || 1) - 1) * (parseInt(limit) || 20))
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(filter);

    return successResponse(res, 200, 'Clients récupérés', {
      clients: clients.map(client => ({
        id: client._id.toString(),
        email: client.email,
        nom: client.nom,
        prenom: client.prenom,
        role: client.role,
        agence: client.agence,
        agencyId: client.agencyId,
        isActive: client.isActive,
        limiteAutorisation: client.limiteAutorisation,
        notationClient: client.notationClient,
        classification: client.classification,
        conseillerAssigné: client.conseillerAssigné ? {
          id: client.conseillerAssigné._id,
          nom: client.conseillerAssigné.nom,
          prenom: client.conseillerAssigné.prenom,
          email: client.conseillerAssigné.email,
          telephone: client.conseillerAssigné.telephone
        } : null,
        createdAt: client.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        pages: Math.ceil(total / (parseInt(limit) || 20))
      }
    });

  } catch (error) {
    console.error('🔥 ERREUR récupération clients:', error);
    return errorResponse(res, 500, 'Erreur lors de la récupération des clients');
  }
};

// ============================================
// METTRE À JOUR LE RÔLE (Admin)
// ============================================
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
    if (role) {
      const validRoles = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
      if (!validRoles.includes(role)) {
        return errorResponse(res, 400, 'Rôle invalide');
      }
    }

    // Vérifier et mettre à jour l'agence si fournie
    if (agence) {
      const agency = await Agency.findOne({
        $or: [{ name: agence }, { code: agence }],
        isActive: true
      });
      if (!agency) {
        return errorResponse(res, 400, `L'agence "${agence}" n'existe pas ou est inactive`);
      }
      user.agence = agency.name;
      user.agencyId = agency._id;
    }

    // Mise à jour
    if (role) user.role = role;
    if (limiteAutorisation !== undefined) user.limiteAutorisation = limiteAutorisation;
    user.updatedBy = req.userId;

    await user.save();

    return successResponse(res, 200, 'Rôle mis à jour avec succès', {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        limiteAutorisation: user.limiteAutorisation,
        agence: user.agence,
        agencyId: user.agencyId,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('🔥 ERREUR mise à jour rôle:', error);
    return errorResponse(res, 500, 'Erreur lors de la mise à jour');
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getAllClients,
  updateUserRole
};
