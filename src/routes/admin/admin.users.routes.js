// admin.users.routes.js - VERSION AMÉLIORÉE ET OPTIMISÉE
const express = require('express');
const router = express.Router();

// Import des contrôleurs
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
  getAgencyUsers
} = require('../../controllers/admin.controller');

const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../constants/roles');
const logger = require('../../utils/logger');
const adminService = require('../../services/admin.service');

// ===============================
// MIDDLEWARES SPÉCIFIQUES
// ===============================

/**
 * Middleware pour vérifier les rôles admin
 */
const requireAdmin = (req, res, next) => {
  authorize(ROLES.ADMIN)(req, res, next);
};

/**
 * Middleware pour vérifier les rôles autorisés pour la gestion des agences
 */
const requireAgencyManagement = (allowedRoles = [ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM, ROLES.DCE]) => {
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
 * @access  Admin, DGA, ADG
 */
router.get('/users',
  authenticate,
  requireAgencyManagement([ROLES.ADMIN, ROLES.DGA, ROLES.ADG]),
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
 * @access  Admin, DGA, ADG, RM, DCE
 */
router.get('/clients',
  authenticate,
  requireAgencyManagement([ROLES.ADMIN, ROLES.DGA, ROLES.ADG, ROLES.RM, ROLES.DCE]),
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
router.put('/users/:userId/status',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.DGA]),
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
  authorize([ROLES.ADMIN, ROLES.DGA, ROLES.ADG]),
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
  authorize([ROLES.ADMIN, ROLES.DGA]),
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
  authorize([ROLES.ADMIN, ROLES.DGA]),
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
  authorize([ROLES.ADMIN, ROLES.DGA]),
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
  authorize([ROLES.ADMIN, ROLES.DGA]),
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