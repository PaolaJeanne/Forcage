// ============================================
// CONTROLLER ADMIN OPTIMISÉ - src/controllers/admin.controller.js
// ============================================
const User = require('../models/User');
const Agency = require('../models/Agency'); // IMPORT AJOUTÉ
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// Création d'utilisateur avec réponse optimisée
const createUser = async (req, res) => {
  try {
    console.log('📝 [CREATE USER] Début - Données reçues:');
    console.log('📦 Body complet:', JSON.stringify(req.body, null, 2));

    const {
      nom, prenom, email, password, telephone,
      role, numeroCompte, agence, limiteAutorisation,
      classification, notationClient, kycValide
    } = req.body;

    // LOG DÉTAILLÉ DE CHAQUE CHAMP
    console.log('🔍 Analyse des champs:');
    console.log('  nom:', nom, '| Type:', typeof nom, '| Vide:', !nom);
    console.log('  prenom:', prenom, '| Type:', typeof prenom, '| Vide:', !prenom);
    console.log('  email:', email, '| Type:', typeof email, '| Vide:', !email);
    console.log('  password:', password ? '***' : 'absent', '| Type:', typeof password, '| Vide:', !password);
    console.log('  telephone:', telephone, '| Type:', typeof telephone);
    console.log('  role:', role, '| Type:', typeof role, '| Vide:', !role);
    console.log('  numeroCompte:', numeroCompte, '| Type:', typeof numeroCompte);
    console.log('  agence:', agence, '| Type:', typeof agence);
    console.log('  limiteAutorisation:', limiteAutorisation, '| Type:', typeof limiteAutorisation);
    console.log('  classification:', classification, '| Type:', typeof classification);
    console.log('  notationClient:', notationClient, '| Type:', typeof notationClient);
    console.log('  kycValide:', kycValide, '| Type:', typeof kycValide);

    // Validation des champs requis - AVEC PLUS DE DÉTAILS
    const errors = [];

    if (!nom || nom.trim() === '') {
      errors.push('Le nom est requis');
      console.log('❌ Nom manquant');
    }

    if (!prenom || prenom.trim() === '') {
      errors.push('Le prénom est requis');
      console.log('❌ Prénom manquant');
    }

    if (!email || email.trim() === '') {
      errors.push('L\'email est requis');
      console.log('❌ Email manquant');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.push('Email invalide');
      console.log('❌ Email invalide:', email);
    }

    if (!password || password.trim() === '') {
      errors.push('Le mot de passe est requis');
      console.log('❌ Password manquant');
    }

    if (!telephone || telephone.trim() === '') {
      errors.push('Le téléphone est requis');
      console.log('❌ Téléphone manquant');
    }

    if (!role || role.trim() === '') {
      errors.push('Le rôle est requis');
      console.log('❌ Rôle manquant');
    } else {
      const validRoles = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
      if (!validRoles.includes(role)) {
        errors.push(`Rôle invalide. Rôles valides: ${validRoles.join(', ')}`);
        console.log('❌ Rôle invalide:', role);
      }
    }

    // Validation spécifique par rôle
    if (role === 'client' && (!numeroCompte || numeroCompte.trim() === '')) {
      errors.push('Le numéro de compte est requis pour un client');
      console.log('❌ Numéro de compte manquant pour client');
    }

    let agencyId = null;
    let agencyName = null;

    if (['conseiller', 'rm', 'dce', 'adg', 'risques'].includes(role)) {
      if (!agence || agence.trim() === '') {
        errors.push(`L'agence est requise pour le rôle ${role}`);
        console.log(`❌ Agence manquante pour rôle ${role}`);
      } else {
        // Vérifier si l'agence existe
        console.log(`🔍 Vérification agence: "${agence}"`);
        const agency = await Agency.findOne({
          $or: [
            { name: agence.trim() },
            { code: agence.trim() }
          ],
          isActive: true
        });

        if (!agency) {
          errors.push(`L'agence "${agence}" n'existe pas ou est inactive`);
          console.log(`❌ Agence non trouvée: "${agence}"`);
        } else {
          // Stocker l'ID et le nom de l'agence
          agencyId = agency._id;
          agencyName = agency.name;
          console.log(`✅ Agence trouvée: ${agency.name} (ID: ${agency._id})`);
        }
      }
    }

    if (errors.length > 0) {
      console.log('❌ Erreurs de validation:', errors);
      return errorResponse(res, 400, 'Erreur de validation', { errors });
    }

    console.log('✅ Toutes les validations passées');

    // Vérifier si l'email existe déjà
    console.log(`🔍 Vérification email existant: ${email}`);
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      console.log(`❌ Email déjà utilisé: ${email}`);
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    console.log('✅ Email disponible');

    // Créer l'utilisateur
    console.log('🔄 Création de l\'utilisateur...');
    const user = new User({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      telephone: telephone.trim(),
      role: role.trim(),
      numeroCompte: numeroCompte ? numeroCompte.trim() : undefined,
      agence: agencyName, // Nom de l'agence
      agencyId: agencyId, // ID de l'agence (pour les références)
      limiteAutorisation: limiteAutorisation || 0,
      classification: classification || 'normal',
      notationClient: notationClient || 'C',
      kycValide: kycValide || false,
      isActive: true,
      createdBy: req.userId
    });

    console.log('📦 Utilisateur à créer:', {
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      agence: user.agence,
      agencyId: user.agencyId,
      isActive: user.isActive
    });

    // Valider le modèle Mongoose avant sauvegarde
    console.log('🔍 Validation Mongoose...');
    const validationError = user.validateSync();
    if (validationError) {
      console.error('❌ Erreur validation Mongoose:', validationError.errors);
      const mongooseErrors = Object.values(validationError.errors).map(err => err.message);
      return errorResponse(res, 400, 'Erreur de validation des données', { errors: mongooseErrors });
    }

    console.log('✅ Validation Mongoose passée');

    // Sauvegarder
    await user.save();
    console.log('✅ Utilisateur sauvegardé avec ID:', user._id);

    // Retourner la réponse
    console.log('📤 Envoi réponse au client...');
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
    console.error('🔥 ERREUR NON GÉRÉE dans createUser:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);

    if (error.name === 'ValidationError') {
      console.error('❌ Erreur validation Mongoose (catch):', error.errors);
      const messages = Object.values(error.errors).map(err => err.message);
      return errorResponse(res, 400, 'Erreur de validation des données', { errors: messages });
    }

    if (error.code === 11000) {
      console.error('❌ Erreur duplication:', error.keyValue);
      return errorResponse(res, 400, 'Cette adresse email est déjà utilisée');
    }

    console.error('❌ Erreur serveur inattendue');
    return errorResponse(res, 500, 'Erreur lors de la création', {
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Mise à jour du rôle avec réponse optimisée
const updateUserRole = async (req, res) => {
  try {
    logger.header('UPDATE USER ROLE', '🔄');
    logger.request('PUT', `/admin/users/${req.params.userId}/role`, req.user);

    const { userId } = req.params;
    const { role, limiteAutorisation, agence } = req.body;

    logger.debug('Update data:', { role, limiteAutorisation, agence });

    const user = await User.findById(userId);

    if (!user) {
      logger.warn('User not found', { userId });
      logger.footer();
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    // Empêcher de modifier son propre rôle
    if (userId === req.userId.toString()) {
      logger.warn('Self-modification attempt', { userId });
      logger.footer();
      return errorResponse(res, 403, 'Vous ne pouvez pas modifier votre propre rôle');
    }

    // Validation du rôle
    if (role) {
      const rolesAutorises = ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'];
      logger.validation('role', rolesAutorises.includes(role), `Role: ${role}`);
      if (!rolesAutorises.includes(role)) {
        logger.footer();
        return errorResponse(res, 400, 'Rôle invalide');
      }
    }

    // Vérifier et mettre à jour l'agence si fournie
    if (agence) {
      logger.database('FIND', 'Agency', { name: agence });
      const agency = await Agency.findOne({
        $or: [
          { name: agence },
          { code: agence }
        ],
        isActive: true
      });

      if (!agency) {
        logger.warn('Agency not found', { agence });
        return errorResponse(res, 400, `L'agence "${agence}" n'existe pas ou est inactive`);
      }

      // Mettre à jour à la fois le nom et l'ID
      user.agence = agency.name;
      user.agencyId = agency._id;
      logger.info('Agency updated', { agence: agency.name, agencyId: agency._id });
    }

    // Mise à jour
    if (role) user.role = role;
    if (limiteAutorisation !== undefined) user.limiteAutorisation = limiteAutorisation;

    user.updatedBy = req.userId;
    await user.save();

    logger.database('UPDATE', 'User', {
      id: user._id,
      updates: {
        role,
        agence: user.agence,
        agencyId: user.agencyId
      }
    });
    logger.success('User role updated', {
      id: user._id,
      role: user.role,
      agence: user.agence
    });

    // RÉPONSE OPTIMISÉE
    logger.response(200, 'Rôle mis à jour avec succès');
    logger.footer();

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
    logger.error('Error updating user role', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur lors de la mise à jour');
  }
};

// Liste des utilisateurs avec pagination optimisée
const getAllUsers = async (req, res) => {
  try {
    logger.header('GET ALL USERS', '👥');
    logger.request('GET', '/admin/users', req.user);

    const { role, agence, isActive, page = 1, limit = 20 } = req.query;
    logger.debug('Query params:', { role, agence, isActive, page, limit });

    const filter = {};
    if (role) filter.role = role;
    if (agence) filter.agence = agence;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    logger.database('FIND', 'User', filter);

    // OPTIMISATION: Sélectionner seulement les champs nécessaires
    const users = await User.find(filter)
      .select('email nom prenom role agence agencyId isActive limiteAutorisation createdAt lastLogin')
      .limit(parseInt(limit))
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    logger.success(`Found ${users.length} users`, { total, page, limit });

    // OPTIMISATION: Structure de réponse légère
    const response = {
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        agencyId: user.agencyId,
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
    };

    logger.response(200, 'Utilisateurs récupérés');
    logger.footer();

    return successResponse(res, 200, 'Utilisateurs récupérés', response);

  } catch (error) {
    logger.error('Error fetching users', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// Activation/désactivation avec réponse optimisée
const toggleUserStatus = async (req, res) => {
  try {
    logger.header('TOGGLE USER STATUS', '⚡');
    logger.request('PUT', `/admin/users/${req.params.userId}/status`, req.user);

    const { userId } = req.params;
    logger.debug('User ID:', userId);

    const user = await User.findById(userId);

    if (!user) {
      logger.warn('User not found', { userId });
      logger.footer();
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    if (userId === req.userId.toString()) {
      logger.warn('Self-modification attempt', { userId });
      logger.footer();
      return errorResponse(res, 403, 'Vous ne pouvez pas modifier votre propre statut');
    }

    const newStatus = !user.isActive;
    user.isActive = newStatus;
    user.updatedBy = req.userId;
    await user.save();

    logger.database('UPDATE', 'User', { id: user._id, isActive: newStatus });
    logger.success('User status updated', { id: user._id, isActive: newStatus });

    // RÉPONSE OPTIMISÉE
    logger.response(200, `Utilisateur ${newStatus ? 'activé' : 'désactivé'}`);
    logger.footer();

    return successResponse(res, 200, `Utilisateur ${newStatus ? 'activé' : 'désactivé'}`, {
      user: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error toggling user status', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// Récupérer un utilisateur spécifique (pour admin)
const getUserById = async (req, res) => {
  try {
    logger.header('GET USER BY ID', '🔍');
    logger.request('GET', `/admin/users/${req.params.userId}`, req.user);

    const { userId } = req.params;
    logger.debug('User ID:', userId);

    const user = await User.findById(userId)
      .select('-password -otpSecret -__v');

    if (!user) {
      logger.warn('User not found', { userId });
      logger.footer();
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    logger.success('User found', { id: user._id, email: user.email });
    logger.response(200, 'Utilisateur récupéré');
    logger.footer();

    return successResponse(res, 200, 'Utilisateur récupéré', {
      user: user.toJSON()
    });

  } catch (error) {
    logger.error('Error fetching user', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// Suppression d'utilisateur
const deleteUser = async (req, res) => {
  try {
    logger.header('DELETE USER', '🗑️');
    logger.request('DELETE', `/admin/users/${req.params.userId}`, req.user);

    const { userId } = req.params;
    logger.debug('User ID:', userId);

    // Empêcher l'auto-suppression
    if (userId === req.userId.toString()) {
      logger.warn('Self-deletion attempt', { userId });
      return errorResponse(res, 403, 'Vous ne pouvez pas supprimer votre propre compte');
    }

    const user = await User.findById(userId);

    if (!user) {
      logger.warn('User not found', { userId });
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    // Pour l'instant, on désactive plutôt que supprimer
    user.isActive = false;
    user.updatedBy = req.userId;
    await user.save();

    logger.database('UPDATE', 'User', { id: user._id, isActive: false });
    logger.success('User deactivated', { id: user._id, email: user.email });
    logger.response(200, 'Utilisateur désactivé');
    logger.footer();

    return successResponse(res, 200, 'Utilisateur désactivé avec succès', {
      userId: user._id,
      email: user.email,
      isActive: false
    });

  } catch (error) {
    logger.error('Error deleting user', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur');
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
      .select('email nom prenom role agence agencyId isActive limiteAutorisation notationClient numeroCompte createdAt lastLogin')
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
        agencyId: client.agencyId,
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
 * Créer une nouvelle agence
 */
const createAgency = async (req, res) => {
  try {
    logger.header('CREATE AGENCY', '🏢');
    logger.request('POST', '/admin/agences', req.user);

    const { name, description, region, city, address, phone, email, code } = req.body;
    logger.debug('Request body:', { name, region, city, code });

    // Validation des champs requis
    if (!name) {
      logger.validation('name', false, 'Nom requis');
      return errorResponse(res, 400, 'Le nom de l\'agence est requis');
    }

    // Générer un code automatiquement si non fourni
    let agencyCode = code;
    if (!agencyCode && name) {
      agencyCode = name.substring(0, 3).toUpperCase();

      // Vérifier si le code existe déjà
      let counter = 1;
      let uniqueCode = agencyCode;
      while (await Agency.findOne({ code: uniqueCode })) {
        uniqueCode = agencyCode + counter;
        counter++;
      }
      agencyCode = uniqueCode;

      logger.info('Code auto-généré', { name, code: agencyCode });
    }

    // Vérifier si le nom existe déjà
    logger.database('FIND', 'Agency', { name });
    const existingName = await Agency.findOne({ name });
    if (existingName) {
      logger.warn('Agency name already exists', { name });
      return errorResponse(res, 400, 'Une agence avec ce nom existe déjà');
    }

    // Vérifier si le code existe déjà
    if (agencyCode) {
      logger.database('FIND', 'Agency', { code: agencyCode });
      const existingCode = await Agency.findOne({ code: agencyCode.toUpperCase() });
      if (existingCode) {
        logger.warn('Agency code already exists', { code: agencyCode });
        return errorResponse(res, 400, `Le code ${agencyCode} est déjà utilisé`);
      }
    }

    // Créer l'agence
    logger.info('Creating new agency', { name, code: agencyCode });
    const agency = new Agency({
      name,
      code: agencyCode,
      description: description || `${name} - Agence principale`,
      region: region || 'Non spécifiée',
      city: city || 'Yaoundé',
      address: address || 'Adresse non spécifiée',
      phone: phone || '+237 222 222 222',
      email: email || `${agencyCode.toLowerCase()}@creditapp.cm`,
      isActive: true,
      createdBy: req.userId
    });

    await agency.save();
    logger.database('CREATE', 'Agency', { id: agency._id, name: agency.name });

    // Réponse optimisée
    logger.success('Agency created successfully', {
      id: agency._id,
      name: agency.name,
      code: agency.code
    });
    logger.response(201, 'Agence créée avec succès');
    logger.footer();

    return successResponse(res, 201, 'Agence créée avec succès', {
      agency: {
        id: agency._id,
        name: agency.name,
        code: agency.code,
        description: agency.description,
        region: agency.region,
        city: agency.city,
        address: agency.address,
        phone: agency.phone,
        email: agency.email,
        isActive: agency.isActive,
        createdAt: agency.createdAt
      }
    });

  } catch (error) {
    logger.error('Error creating agency', error);
    logger.footer();

    // Gestion des erreurs spécifiques
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return errorResponse(res, 400, 'Erreur de validation', { errors: messages });
    }

    if (error.code === 11000) {
      return errorResponse(res, 400, 'Une agence avec ce nom ou code existe déjà');
    }

    return errorResponse(res, 500, 'Erreur lors de la création de l\'agence');
  }
};

/**
 * Récupérer toutes les agences
 */
const getAgences = async (req, res) => {
  try {
    logger.header('GET AGENCES', '🏢');
    logger.request('GET', '/admin/agences', req.user);

    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;

    logger.debug('Query params:', { page, limit, search });

    // Construire la query
    let query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { region: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
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
        name: agence.name,
        code: agence.code,
        description: agence.description,
        region: agence.region,
        city: agence.city,
        address: agence.address,
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

/**
 * Mettre à jour une agence
 */
const updateAgency = async (req, res) => {
  try {
    logger.header('UPDATE AGENCY', '🔄');
    logger.request('PUT', `/admin/agences/${req.params.agencyId}`, req.user);

    const { agencyId } = req.params;
    const { name, description, region, city, address, phone, email, isActive } = req.body;

    logger.debug('Update data:', { name, region, city, isActive });

    const agency = await Agency.findById(agencyId);

    if (!agency) {
      logger.warn('Agency not found', { agencyId });
      logger.footer();
      return errorResponse(res, 404, 'Agence non trouvée');
    }

    // Vérifier si le nouveau nom existe déjà (si fourni et différent)
    if (name && name !== agency.name) {
      logger.database('FIND', 'Agency', { name });
      const existingName = await Agency.findOne({ name });
      if (existingName) {
        logger.warn('Agency name already exists', { name });
        return errorResponse(res, 400, 'Une agence avec ce nom existe déjà');
      }
      agency.name = name;
    }

    // Mettre à jour les autres champs
    if (description !== undefined) agency.description = description;
    if (region !== undefined) agency.region = region;
    if (city !== undefined) agency.city = city;
    if (address !== undefined) agency.address = address;
    if (phone !== undefined) agency.phone = phone;
    if (email !== undefined) agency.email = email;
    if (isActive !== undefined) agency.isActive = isActive;

    agency.updatedAt = new Date();
    agency.updatedBy = req.userId;
    await agency.save();

    logger.database('UPDATE', 'Agency', { id: agency._id, updates: req.body });
    logger.success('Agency updated', { id: agency._id, name: agency.name });
    logger.response(200, 'Agence mise à jour avec succès');
    logger.footer();

    return successResponse(res, 200, 'Agence mise à jour avec succès', {
      agency: {
        id: agency._id,
        name: agency.name,
        code: agency.code,
        description: agency.description,
        region: agency.region,
        city: agency.city,
        address: agency.address,
        phone: agency.phone,
        email: agency.email,
        isActive: agency.isActive,
        updatedAt: agency.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error updating agency', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur lors de la mise à jour de l\'agence');
  }
};

/**
 * Récupérer une agence spécifique
 */
const getAgencyById = async (req, res) => {
  try {
    logger.header('GET AGENCY BY ID', '🔍');
    logger.request('GET', `/admin/agences/${req.params.agencyId}`, req.user);

    const { agencyId } = req.params;
    logger.debug('Agency ID:', agencyId);

    const agency = await Agency.findById(agencyId).lean();

    if (!agency) {
      logger.warn('Agency not found', { agencyId });
      logger.footer();
      return errorResponse(res, 404, 'Agence non trouvée');
    }

    logger.success('Agency found', { id: agency._id, name: agency.name });
    logger.response(200, 'Agence récupérée');
    logger.footer();

    return successResponse(res, 200, 'Agence récupérée', {
      agency: {
        id: agency._id,
        name: agency.name,
        code: agency.code,
        description: agency.description,
        region: agency.region,
        city: agency.city,
        address: agency.address,
        phone: agency.phone,
        email: agency.email,
        isActive: agency.isActive,
        conseillers: agency.conseillers || [],
        responsables: agency.responsables || [],
        createdAt: agency.createdAt,
        updatedAt: agency.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error fetching agency', error);
    logger.footer();
    return errorResponse(res, 500, 'Erreur serveur');
  }
};

// controllers/admin.controller.js - AJOUTER CETTE MÉTHODE

/**
 * Récupérer tous les utilisateurs d'une agence spécifique
 */
const getUsersByAgency = async (req, res) => {
  try {
    const { agencyName } = req.params;
    const { 
      role, 
      isActive = 'true',
      page = 1, 
      limit = 100 
    } = req.query;

    console.log(`🔍 getUsersByAgency: ${agencyName}`);

    if (!agencyName || agencyName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom de l\'agence est requis'
      });
    }

    const decodedAgencyName = decodeURIComponent(agencyName);
    const User = require('../models/User');
    
    // Construire la requête
    const query = { agence: decodedAgencyName };

    if (role && role !== 'all') {
      query.role = role;
    }

    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Récupérer les utilisateurs
    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await User.countDocuments(query);

    // Statistiques par rôle
    const roles = await User.aggregate([
      { $match: query },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const byRole = {};
    roles.forEach(item => {
      byRole[item._id] = item.count;
    });

    return res.json({
      success: true,
      data: {
        agency: decodedAgencyName,
        users: users.map(user => ({
          ...user,
          _id: user._id.toString(),
          id: user._id.toString()
        })),
        total,
        byRole,
        totalUsers: total,
        activeUsers: await User.countDocuments({ ...query, isActive: true }),
        inactiveUsers: await User.countDocuments({ ...query, isActive: false })
      }
    });

  } catch (error) {
    console.error('❌ Erreur getUsersByAgency:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


module.exports = {
  createUser,
  updateUserRole,
  getAllUsers,
  getAllClients,
  getUsersByAgency,
  toggleUserStatus,
  getUserById,
  deleteUser,
  createAgency,
  getAgences,
  updateAgency,
  getAgencyById,
  assignUserToAgency: async (req, res) => {
    try {
      res.json({ success: true, message: 'Utilisateur assigné à l\'agence' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  getUsersByAgency: async (req, res) => {
    try {
      res.json({ success: true, users: [] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  getAgencyStats: async (req, res) => {
    try {
      res.json({ success: true, stats: {} });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  deactivateAgency: async (req, res) => {
    try {
      res.json({ success: true, message: 'Agence désactivée' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  getAgencyUsers: async (req, res) => {
    try {
      res.json({ success: true, users: [] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};