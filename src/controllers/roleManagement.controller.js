// src/controllers/roleManagement.controller.js - CONTRÔLEUR DE GESTION DES RÔLES
const User = require('../models/User');
const RoleManagementService = require('../services/roleManagement.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { ROLES } = require('../constants/roles');

class RoleManagementController {
  /**
   * Assigner un rôle à un utilisateur
   */
  static async assignRole(req, res) {
    try {
      const { userId } = req.params;
      const { role, agence, agencyId, classification, notationClient } = req.body;

      console.log('🔐 assignRole:', {
        userId,
        role,
        requestingUserRole: req.user.role
      });

      // Vérifier que l'utilisateur cible existe
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return errorResponse(res, 404, 'Utilisateur non trouvé');
      }

      // Valider l'assignation
      try {
        await RoleManagementService.validateRoleAssignment(role, req.user, targetUser);
      } catch (error) {
        console.error('❌ Validation échouée:', error.message);
        return errorResponse(res, 403, error.message);
      }

      // Valider les champs requis
      try {
        RoleManagementService.validateRequiredFieldsForRole(role, {
          nom: targetUser.nom,
          prenom: targetUser.prenom,
          email: targetUser.email,
          password: targetUser.password,
          agence,
          agencyId,
          numeroCompte: targetUser.numeroCompte
        });
      } catch (error) {
        console.error('❌ Validation champs échouée:', error.message);
        return errorResponse(res, 400, error.message);
      }

      // Assigner le rôle
      const result = await RoleManagementService.assignRole(
        userId,
        role,
        req.user,
        { agence, agencyId, classification, notationClient }
      );

      console.log('✅ Rôle assigné avec succès');

      return successResponse(res, 200, 'Rôle assigné avec succès', {
        user: result
      });

    } catch (error) {
      console.error('❌ Erreur assignation rôle:', error);
      return errorResponse(res, 500, 'Erreur lors de l\'assignation du rôle', {
        details: error.message
      });
    }
  }

  /**
   * Changer le rôle d'un utilisateur
   */
  static async changeRole(req, res) {
    try {
      const { userId } = req.params;
      const { newRole, agence, agencyId } = req.body;

      console.log('🔄 changeRole:', {
        userId,
        newRole,
        requestingUserRole: req.user.role
      });

      // Vérifier que l'utilisateur cible existe
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return errorResponse(res, 404, 'Utilisateur non trouvé');
      }

      // Valider la transition
      try {
        RoleManagementService.validateRoleTransition(targetUser.role, newRole, req.user);
      } catch (error) {
        console.error('❌ Transition invalide:', error.message);
        return errorResponse(res, 403, error.message);
      }

      // Assigner le nouveau rôle
      const result = await RoleManagementService.assignRole(
        userId,
        newRole,
        req.user,
        { agence, agencyId }
      );

      console.log('✅ Rôle changé avec succès');

      return successResponse(res, 200, 'Rôle changé avec succès', {
        user: result,
        previousRole: targetUser.role,
        newRole: newRole
      });

    } catch (error) {
      console.error('❌ Erreur changement rôle:', error);
      return errorResponse(res, 500, 'Erreur lors du changement de rôle', {
        details: error.message
      });
    }
  }

  /**
   * Obtenir les rôles assignables par l'utilisateur courant
   */
  static async getAssignableRoles(req, res) {
    try {
      console.log('📋 getAssignableRoles:', req.user.role);

      const assignableRoles = RoleManagementService.getAssignableRoles(req.user.role);

      if (assignableRoles.length === 0) {
        return errorResponse(res, 403, 'Vous n\'avez pas la permission d\'assigner des rôles');
      }

      // Enrichir avec les informations de rôle
      const rolesInfo = assignableRoles.map(role => {
        const info = RoleManagementService.getRoleInfo(role);
        return {
          value: role,
          label: info?.name || role,
          description: info?.description || '',
          limite: info?.limite || 0
        };
      });

      console.log('✅ Rôles assignables:', rolesInfo);

      return successResponse(res, 200, 'Rôles assignables récupérés', {
        roles: rolesInfo
      });

    } catch (error) {
      console.error('❌ Erreur récupération rôles:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération des rôles');
    }
  }

  /**
   * Obtenir les informations d'un rôle
   */
  static async getRoleInfo(req, res) {
    try {
      const { role } = req.params;

      console.log('ℹ️ getRoleInfo:', role);

      // Vérifier que le rôle est valide
      if (!Object.values(ROLES).includes(role)) {
        return errorResponse(res, 400, 'Rôle invalide');
      }

      const info = RoleManagementService.getRoleInfo(role);

      if (!info) {
        return errorResponse(res, 404, 'Informations de rôle non trouvées');
      }

      console.log('✅ Informations de rôle récupérées');

      return successResponse(res, 200, 'Informations de rôle', {
        role: info
      });

    } catch (error) {
      console.error('❌ Erreur récupération info rôle:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération des informations');
    }
  }

  /**
   * Obtenir les statistiques des rôles
   */
  static async getRoleStatistics(req, res) {
    try {
      console.log('📊 getRoleStatistics');

      // Vérifier les permissions
      if (!['admin', 'dga', 'adg'].includes(req.user.role)) {
        return errorResponse(res, 403, 'Vous n\'avez pas la permission de voir les statistiques');
      }

      const stats = await RoleManagementService.getRoleStatistics();

      // Enrichir avec les informations de rôle
      const enrichedStats = stats.map(stat => {
        const info = RoleManagementService.getRoleInfo(stat._id);
        return {
          role: stat._id,
          roleName: info?.name || stat._id,
          total: stat.count,
          active: stat.active,
          inactive: stat.inactive,
          percentage: ((stat.count / stats.reduce((sum, s) => sum + s.count, 0)) * 100).toFixed(2)
        };
      });

      console.log('✅ Statistiques récupérées');

      return successResponse(res, 200, 'Statistiques des rôles', {
        statistics: enrichedStats,
        total: stats.reduce((sum, s) => sum + s.count, 0)
      });

    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * Obtenir les utilisateurs par rôle
   */
  static async getUsersByRole(req, res) {
    try {
      const { role } = req.params;
      const { agence, isActive } = req.query;

      console.log('👥 getUsersByRole:', { role, agence, isActive });

      // Vérifier que le rôle est valide
      if (!Object.values(ROLES).includes(role)) {
        return errorResponse(res, 400, 'Rôle invalide');
      }

      // Vérifier les permissions
      if (!['admin', 'dga', 'adg', 'dce', 'rm'].includes(req.user.role)) {
        return errorResponse(res, 403, 'Vous n\'avez pas la permission de voir les utilisateurs');
      }

      // Construire les filtres
      const filters = {};
      if (agence) {
        filters.agence = agence;
      }
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      const users = await RoleManagementService.getUsersByRole(role, filters);

      console.log('✅ Utilisateurs récupérés:', users.length);

      return successResponse(res, 200, `Utilisateurs avec rôle ${role}`, {
        role,
        count: users.length,
        users: users.map(u => ({
          id: u._id,
          email: u.email,
          nom: u.nom,
          prenom: u.prenom,
          agence: u.agence,
          isActive: u.isActive,
          createdAt: u.createdAt
        }))
      });

    } catch (error) {
      console.error('❌ Erreur récupération utilisateurs:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération des utilisateurs');
    }
  }

  /**
   * Vérifier les permissions d'un utilisateur
   */
  static async checkPermissions(req, res) {
    try {
      const { userId } = req.params;
      const { action } = req.query;

      console.log('🔍 checkPermissions:', { userId, action });

      // Vérifier que l'utilisateur cible existe
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return errorResponse(res, 404, 'Utilisateur non trouvé');
      }

      // Si une action spécifique est demandée
      if (action) {
        const hasPermission = RoleManagementService.canPerformAction(targetUser.role, action);
        return successResponse(res, 200, 'Vérification de permission', {
          user: {
            id: targetUser._id,
            email: targetUser.email,
            role: targetUser.role
          },
          action,
          hasPermission
        });
      }

      // Sinon, retourner toutes les permissions du rôle
      const roleInfo = RoleManagementService.getRoleInfo(targetUser.role);

      console.log('✅ Permissions récupérées');

      return successResponse(res, 200, 'Permissions de l\'utilisateur', {
        user: {
          id: targetUser._id,
          email: targetUser.email,
          role: targetUser.role
        },
        permissions: roleInfo?.permissions || []
      });

    } catch (error) {
      console.error('❌ Erreur vérification permissions:', error);
      return errorResponse(res, 500, 'Erreur lors de la vérification des permissions');
    }
  }

  /**
   * Obtenir la hiérarchie des rôles
   */
  static async getRoleHierarchy(req, res) {
    try {
      console.log('🔝 getRoleHierarchy');

      const hierarchy = Object.values(ROLES).map(role => {
        const info = RoleManagementService.getRoleInfo(role);
        const level = RoleManagementService.getHierarchyLevel(role);
        return {
          role,
          name: info?.name || role,
          description: info?.description || '',
          level,
          limite: info?.limite || 0,
          permissions: info?.permissions || []
        };
      }).sort((a, b) => a.level - b.level);

      console.log('✅ Hiérarchie récupérée');

      return successResponse(res, 200, 'Hiérarchie des rôles', {
        hierarchy
      });

    } catch (error) {
      console.error('❌ Erreur hiérarchie:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération de la hiérarchie');
    }
  }
}

module.exports = RoleManagementController;
