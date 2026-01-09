// admin.users.routes.js - VERSION AMÉLIORÉE ET OPTIMISÉE
const express = require('express');
const router = express.Router();

const {
  createUser,
  updateUserRole,
  getAllUsers,
  getAllClients,
  toggleUserStatus,
  getUserById,
  deleteUser,
  createAgency,
  getAgences,
  updateAgency,
  getAgencyById,
  assignUserToAgency,
  deactivateAgency,
  getAgencyStats,
  getAgencyUsers,
  assignConseillerToClient // ⬅️ AJOUTEZ CETTE LIGNE
} = require('../../controllers/admin.controller');


const { authenticate, authorize, requireAdmin } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../constants/roles');
const logger = require('../../utils/logger');
const adminService = require('../../services/admin.service');

// ===============================
// MIDDLEWARES SPÉCIFIQUES
// ===============================

/**
 * Middleware pour vérifier les rôles autorisés pour la gestion des agences
 */
const requireAgencyManagement = (allowedRoles = [ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM, ROLES.DCE, ROLES.CONSEILLER]) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non authentifié'
      });
    }

    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé pour cette opération'
      });
    }
  };
};

/**
 * Middleware pour valider l'ID d'agence
 */
const validateAgencyId = (req, res, next) => {
  const { agencyId } = req.params;

  if (!agencyId || !/^[0-9a-fA-F]{24}$/.test(agencyId)) {
    return res.status(400).json({
      success: false,
      message: 'ID d\'agence invalide'
    });
  }

  next();
};

/**
 * Middleware pour valider l'ID utilisateur
 */
const validateUserId = (req, res, next) => {
  const { userId } = req.params;

  if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
    return res.status(400).json({
      success: false,
      message: 'ID utilisateur invalide'
    });
  }

  next();
};

// ===============================
// ROUTES UTILISATEURS
// ===============================

/**
 * @route   POST /api/v1/admin/users
 * @desc    Créer un nouvel utilisateur
 * @access  Admin uniquement
 */
router.post('/users',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      logger.info(`Création utilisateur par admin ${req.user.id}`, { userData: req.body });

      // Validation supplémentaire des données
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({
          success: false,
          message: 'Email et rôle sont obligatoires'
        });
      }

      // Vérifier que le rôle est valide
      const validRoles = Object.values(ROLES);
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Rôle invalide. Rôles valides: ${validRoles.join(', ')}`
        });
      }

      // Créer l'utilisateur
      const result = await createUser(req, res);

      if (result.success) {
        logger.info(`Utilisateur créé avec succès: ${email}`, { userId: result.data.user._id });
      }

    } catch (error) {
      logger.error('Erreur création utilisateur:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'utilisateur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Récupérer tous les utilisateurs avec pagination et filtres
 * @access  Admin, DGA, ADG, RM, DCE, Conseiller
 */
router.get('/users',
  authenticate,
  requireAgencyManagement([ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM, ROLES.DCE, ROLES.CONSEILLER]),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        agence,
        isActive,
        search
      } = req.query;

      logger.info('Récupération utilisateurs', {
        filters: { page, limit, role, agence, isActive, search },
        requestedBy: req.user.id
      });

      const result = await getAllUsers(req, res);

      if (result.success) {
        logger.info(`${result.data.total} utilisateurs récupérés`, {
          page,
          limit,
          totalPages: result.data.totalPages
        });
      }

    } catch (error) {
      logger.error('Erreur récupération utilisateurs:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des utilisateurs',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


/**
 * @route   GET /api/v1/admin/users/agency/:agencyName
 * @desc    Récupérer tous les utilisateurs d'une agence spécifique (par nom)
 * @access  Admin, DGA, ADG, RM, DCE
 */
router.get('/users/agency/:agencyName',
  authenticate,
  requireAgencyManagement([ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM, ROLES.DCE]),
  async (req, res) => {
    try {
      const { agencyName } = req.params;
      const {
        role,
        isActive = 'true',
        page = 1,
        limit = 100
      } = req.query;

      // Décoder le nom de l'agence (en cas d'espaces)
      const decodedAgencyName = decodeURIComponent(agencyName);

      logger.info('Récupération utilisateurs par agence', {
        agencyName: decodedAgencyName,
        filters: { role, isActive, page, limit },
        requestedBy: req.user.id
      });

      // Validation
      if (!decodedAgencyName || decodedAgencyName.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Le nom de l\'agence est requis'
        });
      }

      const User = require('../../models/User');

      // Construire la requête
      const query = {
        agence: decodedAgencyName
      };

      // Filtres optionnels
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
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -refreshToken')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query)
      ]);

      // Calculer les statistiques par rôle
      const roles = await User.aggregate([
        { $match: query },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      const byRole = {};
      roles.forEach(item => {
        byRole[item._id] = item.count;
      });

      logger.info(`${users.length} utilisateurs trouvés pour ${decodedAgencyName}`);

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
          inactiveUsers: await User.countDocuments({ ...query, isActive: false }),
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            hasNextPage: pageNum * limitNum < total,
            hasPrevPage: pageNum > 1
          }
        }
      });

    } catch (error) {
      logger.error('Erreur récupération utilisateurs par agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des utilisateurs de l\'agence',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


/**
 * @route   GET /api/v1/admin/clients
 * @desc    Récupérer tous les clients avec filtres
 * @access  Admin, DGA, ADG, RM, DCE, Conseiller
 */
router.get('/clients',
  authenticate,
  requireAgencyManagement([ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM, ROLES.DCE, ROLES.CONSEILLER]),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        agence,
        notation,
        isActive,
        search
      } = req.query;

      logger.info('Récupération clients', {
        filters: { page, limit, agence, notation, isActive, search },
        requestedBy: req.user.id
      });

      const result = await getAllClients(req, res);

      if (result.success) {
        logger.info(`${result.data.total} clients récupérés`, {
          page,
          limit,
          totalPages: result.data.totalPages
        });
      }

    } catch (error) {
      logger.error('Erreur récupération clients:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/clients/unassigned
 * @desc    Récupérer tous les clients non assignés
 * @access  Admin, DGA, ADG, RM
 */
router.get('/clients/unassigned',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, agence } = req.query;

      logger.info('Récupération clients non assignés', {
        agence,
        requestedBy: req.user.id
      });

      const User = require('../../models/User');

      const query = {
        role: 'client',
        conseillerAssigné: null,
        isActive: true
      };

      if (agence) {
        query.agence = agence;
      }

      const [clients, total] = await Promise.all([
        User.find(query)
          .select('email nom prenom telephone agence notationClient numeroCompte createdAt')
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .sort({ createdAt: -1 })
          .lean(),
        User.countDocuments(query)
      ]);

      return res.json({
        success: true,
        data: {
          clients: clients.map(client => ({
            ...client,
            id: client._id
          })),
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Erreur récupération clients non assignés:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients non assignés',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/users/:userId
 * @desc    Récupérer un utilisateur spécifique
 * @access  Admin, DGA, ADG, RM (seulement pour son agence)
 */
router.get('/users/:userId',
  authenticate,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info('Récupération utilisateur', {
        userId,
        requestedBy: req.user.id
      });

      // Vérifier les autorisations spécifiques
      const User = require('../../models/User');
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier si l'utilisateur a le droit de voir cet utilisateur
      const userRole = req.user.role;

      // Admin et DGA peuvent voir tous les utilisateurs
      if ([ROLES.ADMIN, ROLES.DGA].includes(userRole)) {
        return await getUserById(req, res);
      }

      // ADG peut voir tous les utilisateurs
      if (userRole === ROLES.ADG) {
        return await getUserById(req, res);
      }

      // RM ne peut voir que les utilisateurs de son agence
      if (userRole === ROLES.RM) {
        if (user.agence === req.user.agence) {
          return await getUserById(req, res);
        } else {
          return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à cet utilisateur'
          });
        }
      }

      // Pour les autres rôles, vérifier avec authorize
      const allowedRoles = [ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM];
      authorize(allowedRoles)(req, res, () => getUserById(req, res));

    } catch (error) {
      logger.error('Erreur récupération utilisateur:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'utilisateur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/users/:userId
 * @desc    Mettre à jour un utilisateur (profil, KYC, etc.)
 * @access  Admin, DGA, ADG, ou l'utilisateur lui-même
 */
router.put('/users/:userId',
  authenticate,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { nom, prenom, telephone, cni, numeroCompte, classification, notationClient, kycValide, dateKyc } = req.body;

      logger.info('Mise à jour utilisateur', {
        userId,
        updatedBy: req.user.id,
        updates: Object.keys(req.body)
      });

      // Vérifier les permissions
      const isAdmin = [ROLES.ADMIN, ROLES.DGA, ROLES.ADG].includes(req.user.role);
      const isOwner = userId === req.user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cet utilisateur'
        });
      }

      // Récupérer l'utilisateur
      const User = require('../../models/User');
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Mettre à jour les champs autorisés
      if (nom) user.nom = nom;
      if (prenom) user.prenom = prenom;
      if (telephone) user.telephone = telephone;
      
      // Champs KYC (admin seulement)
      if (isAdmin) {
        if (cni) user.numeroCNI = cni;
        if (numeroCompte) user.numeroCompte = numeroCompte;
        if (classification) user.classification = classification;
        if (notationClient) user.notationClient = notationClient;
        if (kycValide !== undefined) {
          user.kycValide = kycValide;
          if (kycValide) {
            user.dateKyc = dateKyc || new Date();
          }
        }
      }

      await user.save();

      logger.info(`Utilisateur ${userId} mis à jour`);

      return res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: {
          user: {
            id: user._id,
            email: user.email,
            nom: user.nom,
            prenom: user.prenom,
            telephone: user.telephone,
            cni: user.numeroCNI,
            numeroCompte: user.numeroCompte,
            classification: user.classification,
            notationClient: user.notationClient,
            kycValide: user.kycValide,
            dateKyc: user.dateKyc,
            updatedAt: user.updatedAt
          }
        }
      });

    } catch (error) {
      logger.error('Erreur mise à jour utilisateur:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'utilisateur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/users/:userId/role
 * @desc    Mettre à jour le rôle d'un utilisateur
 * @access  Admin uniquement
 */
router.put('/users/:userId/role',
  authenticate,
  requireAdmin,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      logger.info('Mise à jour rôle utilisateur', {
        userId,
        newRole: role,
        updatedBy: req.user.id
      });

      // Validation du rôle
      const validRoles = Object.values(ROLES);
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Rôle invalide. Rôles valides: ${validRoles.join(', ')}`
        });
      }

      const result = await updateUserRole(req, res);

      if (result.success) {
        logger.info(`Rôle mis à jour pour l'utilisateur ${userId}: ${role}`);
      }

    } catch (error) {
      logger.error('Erreur mise à jour rôle:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du rôle',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/users/:userId/status
 * @desc    Activer/désactiver un utilisateur
 * @access  Admin, DGA
 */
router.put('/users/:userId/toggle-status',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG),
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info('Changement statut utilisateur', {
        userId,
        updatedBy: req.user.id
      });

      const result = await toggleUserStatus(req, res);

      if (result.success) {
        const status = result.data.user.isActive ? 'activé' : 'désactivé';
        logger.info(`Utilisateur ${userId} ${status}`);
      }

    } catch (error) {
      logger.error('Erreur changement statut:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de statut',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/admin/users/:userId
 * @desc    Supprimer (désactiver) un utilisateur
 * @access  Admin uniquement
 */
router.delete('/users/:userId',
  authenticate,
  requireAdmin,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info('Suppression utilisateur', {
        userId,
        deletedBy: req.user.id
      });

      // Empêcher la suppression d'un admin par un autre admin
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Vous ne pouvez pas supprimer votre propre compte'
        });
      }

      const result = await deleteUser(req, res);

      if (result.success) {
        logger.info(`Utilisateur ${userId} supprimé/désactivé`);
      }

    } catch (error) {
      logger.error('Erreur suppression utilisateur:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de l\'utilisateur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/users/:userId/assign-agency
 * @desc    Assigner un utilisateur à une agence
 * @access  Admin, DGA, ADG
 */
router.put('/users/:userId/assign-agency',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG),
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { agence, role = 'conseiller' } = req.body;

      logger.info('Assignation utilisateur à agence', {
        userId,
        agence,
        role,
        assignedBy: req.user.id
      });

      if (!agence || agence.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Le nom de l\'agence est requis'
        });
      }

      // Valider le rôle
      const validAgencyRoles = ['conseiller', 'rm', 'dce', 'manager'];
      if (!validAgencyRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Rôle invalide. Rôles autorisés: ${validAgencyRoles.join(', ')}`
        });
      }

      const result = await assignUserToAgency(userId, agence.trim(), role, req.user.id);

      return res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      logger.error('Erreur assignation agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'assignation à l\'agence',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ===============================
// ROUTES AGENCES
// ===============================

/**
 * @route   POST /api/v1/admin/agences
 * @desc    Créer une nouvelle agence
 * @access  Admin, DGA
 */
router.post('/agences',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG),
  async (req, res) => {
    try {
      const { name, code, region, city, address } = req.body;

      logger.info('Création agence', {
        name,
        code,
        region,
        createdBy: req.user.id
      });

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: 'Le nom et le code de l\'agence sont obligatoires'
        });
      }

      const result = await createAgency(req, res);

      if (result.success) {
        logger.info(`Agence créée: ${name} (${code})`);
      }

    } catch (error) {
      logger.error('Erreur création agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'agence',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/agences
 * @desc    Récupérer toutes les agences
 * @access  Admin, DGA, ADG, RM, DCE
 */
router.get('/agences',
  authenticate,
  requireAgencyManagement(),
  async (req, res) => {
    try {
      const { isActive, region, withStats } = req.query;

      logger.info('Récupération agences', {
        filters: { isActive, region, withStats },
        requestedBy: req.user.id
      });

      const result = await getAgences(req, res);

      if (result.success) {
        logger.info(`${result.data.total} agences récupérées`);
      }

    } catch (error) {
      logger.error('Erreur récupération agences:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des agences',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/agences/stats
 * @desc    Récupérer les statistiques des agences
 * @access  Admin, DGA, ADG
 */
router.get('/agences/stats',
  authenticate,
  requireAgencyManagement([ROLES.ADMIN, ROLES.DGA, ROLES.ADG]),
  async (req, res) => {
    try {
      const { region, period } = req.query;

      logger.info('Récupération statistiques agences', {
        filters: { region, period },
        requestedBy: req.user.id
      });

      const result = await getAgencyStats(region, period);

      return res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      logger.error('Erreur récupération stats agences:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/agences/:agencyId
 * @desc    Récupérer une agence spécifique
 * @access  Admin, DGA, ADG, RM, DCE
 */
router.get('/agences/:agencyId',
  authenticate,
  requireAgencyManagement(),
  validateAgencyId,
  async (req, res) => {
    try {
      const { agencyId } = req.params;
      const { withUsers, withStats } = req.query;

      logger.info('Récupération agence', {
        agencyId,
        requestedBy: req.user.id
      });

      const result = await getAgencyById(req, res);

      if (result.success) {
        logger.info(`Agence récupérée: ${result.data.agency.name}`);
      }

    } catch (error) {
      logger.error('Erreur récupération agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'agence',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/agences/:agencyId
 * @desc    Mettre à jour une agence
 * @access  Admin, DGA
 */
router.put('/agences/:agencyId',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG),
  validateAgencyId,
  async (req, res) => {
    try {
      const { agencyId } = req.params;

      logger.info('Mise à jour agence', {
        agencyId,
        updatedBy: req.user.id,
        updates: req.body
      });

      const result = await updateAgency(req, res);

      if (result.success) {
        logger.info(`Agence ${agencyId} mise à jour`);
      }

    } catch (error) {
      logger.error('Erreur mise à jour agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'agence',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/admin/agences/:agencyId
 * @desc    Désactiver une agence
 * @access  Admin, DGA
 */
router.delete('/agences/:agencyId',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG),
  validateAgencyId,
  async (req, res) => {
    try {
      const { agencyId } = req.params;

      logger.info('Désactivation agence', {
        agencyId,
        deactivatedBy: req.user.id
      });

      // Vérifier si l'agence a des utilisateurs actifs
      const User = require('../../models/User');
      const activeUsersCount = await User.countDocuments({
        agence: { $exists: true },
        isActive: true
      });

      if (activeUsersCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de désactiver une agence avec des utilisateurs actifs',
          data: { activeUsersCount }
        });
      }

      const result = await deactivateAgency(agencyId, req.user.id);

      return res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      logger.error('Erreur désactivation agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la désactivation de l\'agence',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/agences/:agencyId/users
 * @desc    Lister tous les utilisateurs d'une agence
 * @access  Admin, DGA, ADG, RM, DCE (RM/DCE seulement pour leur agence)
 */
router.get('/agences/:agencyId/users',
  authenticate,
  validateAgencyId,
  async (req, res) => {
    try {
      const { agencyId } = req.params;
      const { role, isActive, page = 1, limit = 20 } = req.query;

      logger.info('Récupération utilisateurs agence', {
        agencyId,
        filters: { role, isActive, page, limit },
        requestedBy: req.user.id
      });

      // Vérifier les autorisations spécifiques
      const Agency = require('../../models/Agency');
      const agency = await Agency.findById(agencyId);

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agence non trouvée'
        });
      }

      const userRole = req.user.role;

      // Admin, DGA, ADG peuvent voir toutes les agences
      if ([ROLES.ADMIN, ROLES.DGA, ROLES.ADG].includes(userRole)) {
        const result = await getAgencyUsers(agencyId, { role, isActive, page, limit });
        return res.status(result.success ? 200 : 400).json(result);
      }

      // RM et DCE ne peuvent voir que leur propre agence
      if ([ROLES.RM, ROLES.DCE].includes(userRole)) {
        // Vérifier si l'utilisateur appartient à cette agence
        const User = require('../../models/User');
        const user = await User.findById(req.user.id);

        if (user && user.agence === agency.name) {
          const result = await getAgencyUsers(agencyId, { role, isActive, page, limit });
          return res.status(result.success ? 200 : 400).json(result);
        } else {
          return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à cette agence'
          });
        }
      }

      // Pour les autres rôles, refuser l'accès
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });

    } catch (error) {
      logger.error('Erreur listage utilisateurs agence:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du listage des utilisateurs',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ===============================
// ROUTES SPÉCIALES
// ===============================

/**
 * @route   GET /api/v1/admin/export/users
 * @desc    Exporter la liste des utilisateurs
 * @access  Admin, DGA
 */
router.get('/export/users',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA),
  async (req, res) => {
    try {
      const { format = 'csv', includeInactive = false } = req.query;

      logger.info('Export utilisateurs', {
        format,
        includeInactive,
        requestedBy: req.user.id
      });

      // Implémenter la logique d'export selon le format
      const result = await adminService.exportUsers(format, includeInactive === 'true');

      if (result.success) {
        // Définir les en-têtes selon le format
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.csv`);
        } else if (format === 'excel') {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.xlsx`);
        }

        return res.send(result.data);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Erreur export utilisateurs:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export des utilisateurs'
      });
    }
  }
);

/**
 * @route   PUT /api/v1/admin/clients/:clientId/assign-conseiller/:conseillerId
 * @desc    Assigner ou désassigner un conseiller à un client
 * @access  Admin, DGA, ADG, RM
 */
router.put('/clients/:clientId/assign-conseiller/:conseillerId',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM),
  async (req, res) => {
    try {
      const { clientId, conseillerId } = req.params;
      const { assign = true } = req.body;

      logger.info('Assignation conseiller-client', {
        clientId,
        conseillerId,
        assign,
        assignedBy: req.user.id
      });

      // Validation des IDs
      if (!clientId || !/^[0-9a-fA-F]{24}$/.test(clientId)) {
        return res.status(400).json({
          success: false,
          message: 'ID client invalide'
        });
      }

      if (!conseillerId || !/^[0-9a-fA-F]{24}$/.test(conseillerId)) {
        return res.status(400).json({
          success: false,
          message: 'ID conseiller invalide'
        });
      }

      // Empêcher l'auto-assignation
      if (clientId === conseillerId) {
        return res.status(400).json({
          success: false,
          message: 'Un client ne peut pas être son propre conseiller'
        });
      }

      const result = await assignConseillerToClient(req, res);
      return result;

    } catch (error) {
      logger.error('Erreur assignation conseiller-client:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'assignation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/v1/admin/conseillers/:conseillerId/clients
 * @desc    Récupérer tous les clients d'un conseiller
 * @access  Admin, DGA, ADG, RM, DCE, Conseiller (seulement ses propres clients)
 */
router.get('/conseillers/:conseillerId/clients',
  authenticate,
  async (req, res) => {
    try {
      const { conseillerId } = req.params;
      const { page = 1, limit = 20, isActive = true } = req.query;

      logger.info('Récupération clients du conseiller', {
        conseillerId,
        requestedBy: req.user.id
      });

      // Vérifier les permissions
      const userRole = req.user.role;
      const userId = req.user.id;

      // Si l'utilisateur n'est pas admin/DGA/ADG/RM et demande un autre conseiller que lui-même
      if (![ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM].includes(userRole)) {
        if (conseillerId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez voir que vos propres clients'
          });
        }
      }

      const User = require('../../models/User');

      // Vérifier que le conseiller existe
      const conseiller = await User.findById(conseillerId);
      if (!conseiller) {
        return res.status(404).json({
          success: false,
          message: 'Conseiller non trouvé'
        });
      }

      // Vérifier que c'est bien un conseiller
      if (!['conseiller', 'rm'].includes(conseiller.role)) {
        return res.status(400).json({
          success: false,
          message: 'L\'utilisateur n\'est pas un conseiller'
        });
      }

      // Récupérer les clients assignés
      const query = {
        role: 'client',
        conseillerAssigné: conseillerId,
        isActive: isActive === 'true'
      };

      const [clients, total] = await Promise.all([
        User.find(query)
          .select('email nom prenom telephone agence notationClient numeroCompte isActive createdAt')
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .sort({ nom: 1 })
          .lean(),
        User.countDocuments(query)
      ]);

      // Statistiques
      const stats = await User.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalActifs: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            moyenneNotation: { $avg: '$notationClient' }
          }
        }
      ]);

      return res.json({
        success: true,
        data: {
          conseiller: {
            id: conseiller._id,
            email: conseiller.email,
            nom: conseiller.nom,
            prenom: conseiller.prenom,
            role: conseiller.role,
            agence: conseiller.agence
          },
          clients: clients.map(client => ({
            ...client,
            id: client._id
          })),
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
          },
          stats: stats[0] || { total: 0, totalActifs: 0, moyenneNotation: 0 }
        }
      });

    } catch (error) {
      logger.error('Erreur récupération clients conseiller:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


/**
 * @route   POST /api/v1/admin/users/bulk
 * @desc    Créer plusieurs utilisateurs en masse
 * @access  Admin uniquement
 */
router.post('/users/bulk',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const { users } = req.body;

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Un tableau d\'utilisateurs est requis'
        });
      }

      if (users.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 100 utilisateurs par import'
        });
      }

      logger.info('Import massif utilisateurs', {
        count: users.length,
        importedBy: req.user.id
      });

      const result = await adminService.bulkCreateUsers(users, req.user.id);

      return res.status(result.success ? 201 : 400).json(result);

    } catch (error) {
      logger.error('Erreur import massif utilisateurs:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'import massif des utilisateurs',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;