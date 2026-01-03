// src/routes/roleManagement.routes.js - ROUTES DE GESTION DES RÔLES
const express = require('express');
const router = express.Router();
const roleManagementController = require('../controllers/roleManagement.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================
router.use(authenticate);

// ==================== ROUTES PUBLIQUES (AUTHENTIFIÉES) ====================

/**
 * GET /api/v1/roles/hierarchy
 * Obtenir la hiérarchie complète des rôles
 * Accessible à tous les utilisateurs authentifiés
 */
router.get('/hierarchy', roleManagementController.getRoleHierarchy);

/**
 * GET /api/v1/roles/assignable
 * Obtenir les rôles que l'utilisateur courant peut assigner
 * Accessible aux utilisateurs avec permission d'assigner
 */
router.get('/assignable', roleManagementController.getAssignableRoles);

/**
 * GET /api/v1/roles/:role
 * Obtenir les informations d'un rôle spécifique
 * Accessible à tous les utilisateurs authentifiés
 */
router.get('/:role', roleManagementController.getRoleInfo);

/**
 * GET /api/v1/roles/:role/users
 * Obtenir les utilisateurs avec un rôle spécifique
 * Accessible aux administrateurs et responsables
 */
router.get(
  '/:role/users',
  authorize('admin', 'dga', 'adg', 'dce', 'rm'),
  roleManagementController.getUsersByRole
);

// ==================== ROUTES PROTÉGÉES (ADMIN SEULEMENT) ====================

/**
 * GET /api/v1/roles/statistics
 * Obtenir les statistiques des rôles
 * Accessible aux administrateurs
 */
router.get(
  '/statistics',
  authorize('admin', 'dga', 'adg'),
  roleManagementController.getRoleStatistics
);

/**
 * POST /api/v1/roles/assign/:userId
 * Assigner un rôle à un utilisateur
 * Accessible aux administrateurs et responsables
 * Body: { role, agence?, agencyId?, classification?, notationClient? }
 */
router.post(
  '/assign/:userId',
  authorize('admin', 'dga', 'adg', 'dce', 'rm'),
  roleManagementController.assignRole
);

/**
 * PATCH /api/v1/roles/change/:userId
 * Changer le rôle d'un utilisateur
 * Accessible aux administrateurs
 * Body: { newRole, agence?, agencyId? }
 */
router.patch(
  '/change/:userId',
  authorize('admin', 'dga'),
  roleManagementController.changeRole
);

/**
 * GET /api/v1/roles/check/:userId
 * Vérifier les permissions d'un utilisateur
 * Accessible aux administrateurs
 * Query: ?action=ACTION_NAME (optionnel)
 */
router.get(
  '/check/:userId',
  authorize('admin', 'dga', 'adg'),
  roleManagementController.checkPermissions
);

module.exports = router;
