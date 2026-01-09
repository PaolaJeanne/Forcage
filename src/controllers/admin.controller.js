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
    console.log('🔍 [DEBUG getAllUsers] Début ============');
    console.log('User making request:', req.user?.id, req.user?.email, req.user?.role);
    console.log('Query params:', req.query);

    const { role, agence, isActive, page = 1, limit = 20 } = req.query;

    // DEBUG: Vérifiez que User est bien importé
    console.log('🔄 Étape 1: Vérification modèle User...');
    const User = require('../models/User');
    console.log('✅ Modèle User chargé');

    // DEBUG: Simple count pour tester
    console.log('🔄 Étape 2: Count documents...');
    const totalCount = await User.countDocuments({});
    console.log(`✅ Total documents: ${totalCount}`);

    // Construire le filtre
    const filter = {};
    if (role) {
      console.log(`Filtre role: ${role}`);
      filter.role = role;
    }
    if (agence) {
      console.log(`Filtre agence: ${agence}`);
      filter.agence = agence;
    }
    if (isActive !== undefined) {
      console.log(`Filtre isActive: ${isActive}`);
      filter.isActive = isActive === 'true';
    }

    console.log('Filtre final:', filter);

    // DEBUG: Trouver des utilisateurs simples
    console.log('🔄 Étape 3: Find avec filtre...');
    const users = await User.find(filter)
      .select('email nom prenom role agence isActive createdAt')
      .limit(parseInt(limit) || 5)
      .skip(((parseInt(page) || 1) - 1) * (parseInt(limit) || 5))
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Users trouvés: ${users.length}`);

    const total = await User.countDocuments(filter);

    // DEBUG: Vérifier le format des données
    console.log('🔄 Étape 4: Formatage réponse...');
    const response = {
      users: users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        isActive: user.isActive,
        createdAt: user.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        pages: Math.ceil(total / (parseInt(limit) || 20))
      }
    };

    console.log('✅ Réponse prête');
    console.log('🔍 [DEBUG getAllUsers] Fin ============');

    return successResponse(res, 200, 'Utilisateurs récupérés', response);

  } catch (error) {
    console.error('🔥 ERREUR CRITIQUE dans getAllUsers:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.name === 'MongoError') {
      console.error('Mongo error code:', error.code);
    }

    return errorResponse(res, 500, 'Erreur serveur détaillée', {
      error: error.message,
      name: error.name,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Activation/désactivation avec réponse optimisée
const toggleUserStatus = async (req, res) => {
  try {
    const notificationService = require('../services/notification.service');
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

    // Envoyer une notification
    try {
      await notificationService.createNotification({
        utilisateur: user._id,
        titre: newStatus ? 'Compte activé' : 'Compte désactivé',
        message: newStatus
          ? 'Votre compte a été activé. Vous pouvez maintenant vous connecter.'
          : 'Votre compte a été désactivé par un administrateur.',
        entite: 'systeme',
        type: newStatus ? 'success' : 'warning',
        priorite: 'haute',
        categorie: 'system',
        source: 'system',
        metadata: {
          status: newStatus ? 'active' : 'inactive',
          updatedBy: req.userId
        },
        declencheur: req.userId
      });
      logger.info('Notification sent to user', { userId: user._id });
    } catch (notifError) {
      logger.error('Error sending notification', notifError);
    }

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

    // OPTIMISATION: Sélectionner seulement les champs nécessaires + conseillerAssigné
    const clients = await User.find(filter)
      .select('email nom prenom role agence agencyId isActive limiteAutorisation notationClient numeroCompte conseillerAssigné createdAt lastLogin')
      .populate('conseillerAssigné', 'nom prenom email telephone')
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
        conseillerAssigné: client.conseillerAssigné ? {
          id: client.conseillerAssigné._id,
          nom: client.conseillerAssigné.nom,
          prenom: client.conseillerAssigné.prenom,
          email: client.conseillerAssigné.email,
          telephone: client.conseillerAssigné.telephone
        } : null,
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
 * Assigner un conseiller à un client - VERSION CORRIGÉE
 */
const assignConseillerToClient = async (req, res) => {
  try {
    console.log('🔗 [assignConseillerToClient] Début - Version corrigée');

    const { clientId, conseillerId } = req.params;
    const { assign = true } = req.body; // true pour assigner, false pour désassigner

    console.log('📋 Données reçues:');
    console.log('  - clientId:', clientId);
    console.log('  - conseillerId:', conseillerId);
    console.log('  - assign:', assign);
    console.log('  - body complet:', req.body);
    console.log('  - user qui fait la requête:', req.user);

    // Vérification préliminaire des IDs
    if (!clientId || typeof clientId !== 'string') {
      console.error('❌ clientId invalide:', clientId);
      return errorResponse(res, 400, 'ID client invalide');
    }

    if (!conseillerId || typeof conseillerId !== 'string') {
      console.error('❌ conseillerId invalide:', conseillerId);
      return errorResponse(res, 400, 'ID conseiller invalide');
    }

    // Empêcher l'auto-assignation
    if (clientId === conseillerId) {
      console.error('❌ Auto-assignation détectée');
      return errorResponse(res, 400, 'Un client ne peut pas être son propre conseiller');
    }

    // Vérifier que le client existe
    console.log('🔍 Recherche du client...');
    const client = await User.findById(clientId);
    if (!client) {
      console.error('❌ Client non trouvé avec ID:', clientId);
      console.error('❌ Est-ce un ObjectId valide?', /^[0-9a-fA-F]{24}$/.test(clientId));
      return errorResponse(res, 404, 'Client non trouvé');
    }

    console.log('✅ Client trouvé:', {
      id: client._id.toString(),
      email: client.email,
      nom: client.nom,
      prenom: client.prenom,
      role: client.role,
      conseillerAssigné: client.conseillerAssigné
    });

    // Vérifier que le client a bien le rôle 'client'
    if (!client.role) {
      console.error('❌ Client sans rôle défini');
      console.error('❌ Document client complet:', JSON.stringify(client.toObject ? client.toObject() : client, null, 2));
      return errorResponse(res, 400, 'Le client n\'a pas de rôle défini');
    }

    const clientRole = String(client.role).toLowerCase().trim();
    if (clientRole !== 'client') {
      console.error('❌ Utilisateur n\'est pas un client:', clientRole);
      return errorResponse(res, 400, `L'utilisateur doit être un client (rôle actuel: ${clientRole})`);
    }

    // Vérifier que le conseiller existe
    console.log('🔍 Recherche du conseiller...');
    const conseiller = await User.findById(conseillerId);
    if (!conseiller) {
      console.error('❌ Conseiller non trouvé avec ID:', conseillerId);
      console.error('❌ Est-ce un ObjectId valide?', /^[0-9a-fA-F]{24}$/.test(conseillerId));
      return errorResponse(res, 404, 'Conseiller non trouvé');
    }

    console.log('✅ Conseiller trouvé:', {
      id: conseiller._id.toString(),
      email: conseiller.email,
      nom: conseiller.nom,
      prenom: conseiller.prenom,
      role: conseiller.role
    });

    // Vérifier que le conseiller a bien un rôle
    if (!conseiller.role) {
      console.error('❌ Conseiller sans rôle défini');
      console.error('❌ Document conseiller complet:', JSON.stringify(conseiller.toObject ? conseiller.toObject() : conseiller, null, 2));
      return errorResponse(res, 400, 'Le conseiller n\'a pas de rôle défini');
    }

    // Normaliser et vérifier le rôle du conseiller
    const conseillerRole = String(conseiller.role).toLowerCase().trim();
    console.log('🔍 Rôle conseiller normalisé:', conseillerRole);

    const rolesConseillerValides = ['conseiller', 'rm'];
    console.log('🔍 Rôles valides pour conseiller:', rolesConseillerValides);
    console.log('🔍 Est conseiller/rm?', rolesConseillerValides.includes(conseillerRole));

    if (!rolesConseillerValides.includes(conseillerRole)) {
      console.error('❌ Utilisateur n\'est pas un conseiller ou RM:', conseillerRole);
      return errorResponse(res, 400, `L'utilisateur doit être un conseiller ou RM (rôle actuel: ${conseillerRole})`);
    }

    console.log('✅ Toutes les validations passées');

    if (assign) {
      console.log('🔄 Début de l\'assignation...');

      // Vérifier si déjà assigné
      if (client.conseillerAssigné && client.conseillerAssigné.toString() === conseillerId) {
        console.log('⚠️ Client déjà assigné à ce conseiller');
        return successResponse(res, 200, 'Client déjà assigné à ce conseiller', {
          client: {
            id: client._id,
            email: client.email,
            nom: client.nom,
            prenom: client.prenom
          },
          conseiller: {
            id: conseiller._id,
            email: conseiller.email,
            nom: conseiller.nom,
            prenom: conseiller.prenom
          }
        });
      }

      // Désassigner l'ancien conseiller si présent
      if (client.conseillerAssigné) {
        console.log('🔄 Désassignation de l\'ancien conseiller...');
        const ancienConseiller = await User.findById(client.conseillerAssigné);
        if (ancienConseiller) {
          if (ancienConseiller.clients) {
            ancienConseiller.clients = ancienConseiller.clients.filter(
              id => id.toString() !== clientId
            );
            await ancienConseiller.save();
          }
          console.log('✅ Ancien conseiller désassigné:', ancienConseiller.email);
        }
      }

      // Assigner le nouveau conseiller
      console.log('🔄 Assignation du nouveau conseiller...');
      client.conseillerAssigné = conseillerId;
      await client.save();
      console.log('✅ Client mis à jour avec nouveau conseiller');

      // Initialiser le tableau clients s'il n'existe pas
      if (!conseiller.clients) {
        conseiller.clients = [];
        console.log('✅ Tableau clients initialisé pour le conseiller');
      }

      // Ajouter le client à la liste des clients du conseiller
      const clientIdStr = clientId.toString();
      if (!conseiller.clients.some(id => id.toString() === clientIdStr)) {
        conseiller.clients.push(clientId);
        await conseiller.save();
        console.log('✅ Client ajouté à la liste du conseiller');
      } else {
        console.log('⚠️ Client déjà dans la liste du conseiller');
      }

      console.log('✅ Assignation terminée avec succès');
      console.log('📊 Résumé:');
      console.log('  Client:', client.email);
      console.log('  Conseiller:', conseiller.email);
      console.log('  Nombre de clients du conseiller:', conseiller.clients.length);

      // Notification (optionnel)
      try {
        await createAssignmentNotification(client, conseiller, req.userId);
        console.log('✅ Notifications créées');
      } catch (notifError) {
        console.error('⚠️ Erreur création notifications:', notifError.message);
        // Ne pas bloquer l'assignation pour une erreur de notification
      }

      return successResponse(res, 200, 'Conseiller assigné avec succès', {
        client: {
          id: client._id,
          email: client.email,
          nom: client.nom,
          prenom: client.prenom,
          conseillerAssigné: {
            id: conseiller._id,
            email: conseiller.email,
            nom: conseiller.nom,
            prenom: conseiller.prenom
          }
        },
        conseiller: {
          id: conseiller._id,
          email: conseiller.email,
          nom: conseiller.nom,
          prenom: conseiller.prenom,
          totalClients: conseiller.clients.length
        }
      });

    } else {
      console.log('🔄 Début de la désassignation...');

      // Vérifier si le client est assigné à ce conseiller
      if (!client.conseillerAssigné || client.conseillerAssigné.toString() !== conseillerId) {
        console.log('⚠️ Client non assigné à ce conseiller');
        return successResponse(res, 200, 'Client non assigné à ce conseiller');
      }

      // Désassigner
      client.conseillerAssigné = null;
      await client.save();
      console.log('✅ Client désassigné');

      // Retirer le client de la liste du conseiller
      if (conseiller.clients) {
        const initialLength = conseiller.clients.length;
        conseiller.clients = conseiller.clients.filter(
          id => id.toString() !== clientId
        );

        if (conseiller.clients.length < initialLength) {
          await conseiller.save();
          console.log('✅ Client retiré de la liste du conseiller');
        }
      }

      // Envoyer une notification de désassignation
      try {
        await createUnassignmentNotification(client, conseiller, req.userId);
        console.log('✅ Notifications de désassignation créées');
      } catch (notifError) {
        console.error('⚠️ Erreur création notifications désassignation:', notifError.message);
      }

      console.log('✅ Désassignation terminée avec succès');

      return successResponse(res, 200, 'Conseiller désassigné avec succès', {
        client: {
          id: client._id,
          email: client.email,
          nom: client.nom,
          prenom: client.prenom,
          conseillerAssigné: null
        },
        conseiller: {
          id: conseiller._id,
          email: conseiller.email,
          nom: conseiller.nom,
          prenom: conseiller.prenom,
          totalClients: conseiller.clients ? conseiller.clients.length : 0
        }
      });
    }

  } catch (error) {
    console.error('🔥 ERREUR assignConseillerToClient:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    console.error('  Name:', error.name);
    console.error('  Code:', error.code);

    // Log supplémentaire pour les erreurs Mongoose
    if (error.name === 'CastError') {
      console.error('  CastError path:', error.path);
      console.error('  CastError value:', error.value);
      console.error('  CastError kind:', error.kind);
    }

    return errorResponse(res, 500, 'Erreur lors de l\'assignation', {
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Fonction helper pour créer une notification d'assignation
 */
const createAssignmentNotification = async (client, conseiller, adminId) => {
  try {
    const notificationService = require('../services/notification.service');

    // Notification pour le client
    await notificationService.createNotification({
      utilisateur: client._id,
      titre: 'Nouveau conseiller assigné',
      message: `M. ${conseiller.nom} ${conseiller.prenom} est maintenant votre conseiller`,
      entite: 'user',
      entiteId: conseiller._id,
      type: 'info',
      priorite: 'normale',
      categorie: 'client',
      metadata: {
        conseillerId: conseiller._id,
        conseillerNom: `${conseiller.nom} ${conseiller.prenom}`,
        assignedBy: adminId,
        type: 'ASSIGNATION_CONSEILLER'
      },
      source: 'system',
      declencheur: adminId
    });

    // Notification pour le conseiller
    await notificationService.createNotification({
      utilisateur: conseiller._id,
      titre: 'Nouveau client assigné',
      message: `M. ${client.nom} ${client.prenom} vous a été assigné comme client`,
      entite: 'user',
      entiteId: client._id,
      type: 'info',
      priorite: 'normale',
      categorie: 'client',
      metadata: {
        clientId: client._id,
        clientNom: `${client.nom} ${client.prenom}`,
        assignedBy: adminId,
        type: 'NOUVEAU_CLIENT'
      },
      source: 'system',
      declencheur: adminId
    });

    console.log('✅ Notifications créées via NotificationService');
  } catch (error) {
    console.error('❌ Erreur création notifications:', error);
  }
};

/**
 * Fonction helper pour créer une notification de désassignation
 */
const createUnassignmentNotification = async (client, conseiller, adminId) => {
  try {
    const notificationService = require('../services/notification.service');

    // Notification pour le client
    await notificationService.createNotification({
      utilisateur: client._id,
      titre: 'Mise à jour de votre dossier',
      message: `M. ${conseiller.nom} ${conseiller.prenom} n'est plus votre conseiller`,
      entite: 'user',
      entiteId: conseiller._id,
      type: 'info',
      priorite: 'normale',
      categorie: 'client',
      metadata: {
        conseillerId: conseiller._id,
        conseillerNom: `${conseiller.nom} ${conseiller.prenom}`,
        unassignedBy: adminId,
        type: 'DESASSIGNATION_CONSEILLER'
      },
      source: 'system',
      declencheur: adminId
    });

    // Notification pour le conseiller
    await notificationService.createNotification({
      utilisateur: conseiller._id,
      titre: 'Mise à jour portefeuille client',
      message: `Le client M. ${client.nom} ${client.prenom} a été retiré de votre portefeuille`,
      entite: 'user',
      entiteId: client._id,
      type: 'info',
      priorite: 'normale',
      categorie: 'client',
      metadata: {
        clientId: client._id,
        clientNom: `${client.nom} ${client.prenom}`,
        unassignedBy: adminId,
        type: 'RETRAIT_CLIENT'
      },
      source: 'system',
      declencheur: adminId
    });

    console.log('✅ Notifications de désassignation créées via NotificationService');
  } catch (error) {
    console.error('❌ Erreur création notifications désassignation:', error);
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
  assignConseillerToClient,
  getUserById,
  deleteUser,
  createAgency,
  getAgences,
  updateAgency,
  getAgencyById
};