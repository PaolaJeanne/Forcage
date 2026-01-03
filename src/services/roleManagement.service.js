// src/services/roleManagement.service.js - SERVICE DE GESTION DES RÔLES
const User = require('../models/User');
const { LIMITES_AUTORISATION, HIERARCHY, ROLES } = require('../constants/roles');

class RoleManagementService {
  /**
   * Valider l'assignation d'un rôle
   */
  static async validateRoleAssignment(targetRole, requestingUser, targetUser = null) {
    console.log('🔐 validateRoleAssignment:', {
      targetRole,
      requestingUserRole: requestingUser.role,
      targetUserId: targetUser?._id
    });

    // Vérifier que le rôle cible est valide
    if (!Object.values(ROLES).includes(targetRole)) {
      throw new Error(`Rôle invalide: ${targetRole}`);
    }

    // Admin peut assigner n'importe quel rôle
    if (requestingUser.role === 'admin') {
      console.log('✅ Admin peut assigner n\'importe quel rôle');
      return true;
    }

    // DGA peut assigner tous les rôles sauf admin
    if (requestingUser.role === 'dga') {
      if (targetRole === 'admin') {
        throw new Error('Seul un admin peut créer un autre admin');
      }
      console.log('✅ DGA peut assigner ce rôle');
      return true;
    }

    // ADG peut assigner les rôles inférieurs
    if (requestingUser.role === 'adg') {
      const allowedRoles = ['client', 'conseiller', 'rm', 'dce'];
      if (!allowedRoles.includes(targetRole)) {
        throw new Error(`ADG ne peut assigner que: ${allowedRoles.join(', ')}`);
      }
      console.log('✅ ADG peut assigner ce rôle');
      return true;
    }

    // DCE peut assigner conseiller et client
    if (requestingUser.role === 'dce') {
      const allowedRoles = ['client', 'conseiller'];
      if (!allowedRoles.includes(targetRole)) {
        throw new Error(`DCE ne peut assigner que: ${allowedRoles.join(', ')}`);
      }
      console.log('✅ DCE peut assigner ce rôle');
      return true;
    }

    // RM peut assigner client et conseiller
    if (requestingUser.role === 'rm') {
      const allowedRoles = ['client', 'conseiller'];
      if (!allowedRoles.includes(targetRole)) {
        throw new Error(`RM ne peut assigner que: ${allowedRoles.join(', ')}`);
      }
      console.log('✅ RM peut assigner ce rôle');
      return true;
    }

    // Les autres rôles ne peuvent pas assigner
    throw new Error(`${requestingUser.role} ne peut pas assigner de rôles`);
  }

  /**
   * Valider les champs requis selon le rôle
   */
  static validateRequiredFieldsForRole(role, data) {
    console.log('📋 validateRequiredFieldsForRole:', { role, fields: Object.keys(data) });

    const requiredFields = {
      client: ['nom', 'prenom', 'email', 'password', 'numeroCompte'],
      conseiller: ['nom', 'prenom', 'email', 'password', 'agence', 'agencyId'],
      rm: ['nom', 'prenom', 'email', 'password', 'agence', 'agencyId'],
      dce: ['nom', 'prenom', 'email', 'password', 'agence', 'agencyId'],
      adg: ['nom', 'prenom', 'email', 'password'],
      dga: ['nom', 'prenom', 'email', 'password'],
      risques: ['nom', 'prenom', 'email', 'password'],
      admin: ['nom', 'prenom', 'email', 'password']
    };

    const required = requiredFields[role] || [];
    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      throw new Error(`Champs requis manquants pour ${role}: ${missing.join(', ')}`);
    }

    console.log('✅ Tous les champs requis sont présents');
    return true;
  }

  /**
   * Assigner un rôle à un utilisateur
   */
  static async assignRole(userId, newRole, requestingUser, additionalData = {}) {
    console.log('🔄 assignRole:', {
      userId,
      newRole,
      requestingUserRole: requestingUser.role
    });

    // Valider l'assignation
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new Error('Utilisateur cible non trouvé');
    }

    await this.validateRoleAssignment(newRole, requestingUser, targetUser);

    // Valider les champs requis
    const dataToValidate = {
      ...targetUser.toObject(),
      ...additionalData
    };
    this.validateRequiredFieldsForRole(newRole, dataToValidate);

    // Mettre à jour le rôle
    targetUser.role = newRole;
    targetUser.limiteAutorisation = LIMITES_AUTORISATION[newRole] || 0;

    // Mettre à jour les champs spécifiques au rôle
    if (additionalData.agence) {
      targetUser.agence = additionalData.agence;
    }
    if (additionalData.agencyId) {
      targetUser.agencyId = additionalData.agencyId;
    }
    if (additionalData.classification) {
      targetUser.classification = additionalData.classification;
    }
    if (additionalData.notationClient) {
      targetUser.notationClient = additionalData.notationClient;
    }

    targetUser.updatedBy = requestingUser._id;
    await targetUser.save();

    console.log('✅ Rôle assigné avec succès:', newRole);

    return {
      id: targetUser._id,
      email: targetUser.email,
      role: targetUser.role,
      limiteAutorisation: targetUser.limiteAutorisation,
      agence: targetUser.agence,
      updatedAt: targetUser.updatedAt
    };
  }

  /**
   * Vérifier si un utilisateur peut effectuer une action
   */
  static canPerformAction(userRole, action, context = {}) {
    console.log('🔍 canPerformAction:', { userRole, action, context });

    const actionPermissions = {
      // Gestion des utilisateurs
      'CREATE_USER': ['admin', 'dga', 'adg', 'dce', 'rm'],
      'UPDATE_USER': ['admin', 'dga', 'adg', 'dce', 'rm'],
      'DELETE_USER': ['admin', 'dga'],
      'ASSIGN_ROLE': ['admin', 'dga', 'adg', 'dce', 'rm'],
      'CHANGE_ROLE': ['admin', 'dga'],

      // Gestion des demandes
      'CREATE_DEMANDE': ['client'],
      'VIEW_DEMANDE': ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
      'EDIT_DEMANDE': ['client', 'conseiller'],
      'SUBMIT_DEMANDE': ['client'],
      'CANCEL_DEMANDE': ['client', 'admin', 'dga'],
      'PROCESS_DEMANDE': ['conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
      'VALIDATE_DEMANDE': ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
      'REJECT_DEMANDE': ['conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
      'ESCALATE_DEMANDE': ['conseiller', 'rm', 'dce', 'adg', 'admin'],
      'DISBURSE_DEMANDE': ['dce', 'adg', 'dga', 'admin'],

      // Gestion des notifications
      'SEND_NOTIFICATION': ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
      'VIEW_NOTIFICATIONS': ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],

      // Gestion des rapports
      'VIEW_REPORTS': ['rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
      'EXPORT_REPORTS': ['dce', 'adg', 'dga', 'admin'],

      // Gestion du système
      'MANAGE_SETTINGS': ['admin', 'dga'],
      'VIEW_AUDIT': ['adg', 'dga', 'risques', 'admin'],
      'MANAGE_AUDIT': ['admin'],
      'VIEW_LOGS': ['admin', 'dga', 'risques']
    };

    const allowedRoles = actionPermissions[action] || [];
    const hasPermission = allowedRoles.includes(userRole);

    console.log(`${hasPermission ? '✅' : '❌'} Action ${action}:`, {
      userRole,
      allowed: hasPermission,
      allowedRoles
    });

    return hasPermission;
  }

  /**
   * Obtenir le niveau hiérarchique d'un rôle
   */
  static getHierarchyLevel(role) {
    const level = HIERARCHY.indexOf(role);
    console.log('📊 getHierarchyLevel:', { role, level });
    return level;
  }

  /**
   * Vérifier si un rôle est supérieur à un autre
   */
  static isHigherRole(roleA, roleB) {
    const levelA = this.getHierarchyLevel(roleA);
    const levelB = this.getHierarchyLevel(roleB);
    const isHigher = levelA > levelB;

    console.log('🔝 isHigherRole:', { roleA, roleB, isHigher });
    return isHigher;
  }

  /**
   * Obtenir le prochain niveau hiérarchique
   */
  static getNextHierarchyLevel(role) {
    const currentLevel = this.getHierarchyLevel(role);
    if (currentLevel === -1 || currentLevel >= HIERARCHY.length - 1) {
      return null;
    }
    const nextRole = HIERARCHY[currentLevel + 1];
    console.log('➡️ getNextHierarchyLevel:', { role, nextRole });
    return nextRole;
  }

  /**
   * Vérifier la limite d'autorisation
   */
  static canAuthorizeMontant(userRole, montant) {
    const limite = LIMITES_AUTORISATION[userRole];

    if (limite === undefined) {
      console.log('❌ Rôle non reconnu:', userRole);
      return false;
    }

    const canAuthorize = montant <= limite;
    console.log('💰 canAuthorizeMontant:', {
      userRole,
      montant,
      limite,
      canAuthorize
    });

    return canAuthorize;
  }

  /**
   * Obtenir les rôles que l'utilisateur peut assigner
   */
  static getAssignableRoles(userRole) {
    console.log('📋 getAssignableRoles:', userRole);

    const assignableRoles = {
      admin: Object.values(ROLES),
      dga: Object.values(ROLES).filter(r => r !== 'admin'),
      adg: ['client', 'conseiller', 'rm', 'dce'],
      dce: ['client', 'conseiller'],
      rm: ['client', 'conseiller'],
      default: []
    };

    const roles = assignableRoles[userRole] || assignableRoles.default;
    console.log('✅ Rôles assignables:', roles);
    return roles;
  }

  /**
   * Obtenir les informations de rôle formatées
   */
  static getRoleInfo(role) {
    const roleInfo = {
      client: {
        name: 'Client',
        description: 'Demandeur de crédit',
        hierarchy: 0,
        limite: 0,
        permissions: ['CREATE_DEMANDE', 'VIEW_DEMANDE', 'SUBMIT_DEMANDE', 'CANCEL_DEMANDE']
      },
      conseiller: {
        name: 'Conseiller',
        description: 'Traite les demandes au niveau agence',
        hierarchy: 1,
        limite: 5000000,
        permissions: ['PROCESS_DEMANDE', 'VALIDATE_DEMANDE', 'REJECT_DEMANDE', 'ESCALATE_DEMANDE']
      },
      rm: {
        name: 'Responsable Mission',
        description: 'Responsable d\'agence',
        hierarchy: 2,
        limite: 10000000,
        permissions: ['PROCESS_DEMANDE', 'VALIDATE_DEMANDE', 'REJECT_DEMANDE', 'ESCALATE_DEMANDE']
      },
      dce: {
        name: 'Directeur Centre d\'Exploitation',
        description: 'Directeur régional',
        hierarchy: 3,
        limite: 20000000,
        permissions: ['PROCESS_DEMANDE', 'VALIDATE_DEMANDE', 'REJECT_DEMANDE', 'ESCALATE_DEMANDE', 'DISBURSE_DEMANDE']
      },
      adg: {
        name: 'Assistant Directeur Général',
        description: 'Niveau national',
        hierarchy: 4,
        limite: 50000000,
        permissions: ['PROCESS_DEMANDE', 'VALIDATE_DEMANDE', 'REJECT_DEMANDE', 'ESCALATE_DEMANDE', 'DISBURSE_DEMANDE']
      },
      dga: {
        name: 'Directeur Général Adjoint',
        description: 'Niveau exécutif',
        hierarchy: 5,
        limite: 100000000,
        permissions: ['PROCESS_DEMANDE', 'VALIDATE_DEMANDE', 'REJECT_DEMANDE', 'ESCALATE_DEMANDE', 'DISBURSE_DEMANDE', 'MANAGE_SETTINGS']
      },
      risques: {
        name: 'Gestionnaire Risques',
        description: 'Analyse les risques',
        hierarchy: 5,
        limite: 0,
        permissions: ['PROCESS_DEMANDE', 'REJECT_DEMANDE', 'VIEW_REPORTS']
      },
      admin: {
        name: 'Administrateur',
        description: 'Gestion système complète',
        hierarchy: 6,
        limite: Infinity,
        permissions: ['MANAGE_SETTINGS', 'VIEW_AUDIT', 'MANAGE_AUDIT', 'VIEW_LOGS']
      }
    };

    return roleInfo[role] || null;
  }

  /**
   * Valider la transition de rôle
   */
  static validateRoleTransition(currentRole, newRole, requestingUser) {
    console.log('🔄 validateRoleTransition:', {
      currentRole,
      newRole,
      requestingUserRole: requestingUser.role
    });

    // Vérifier que le nouveau rôle est valide
    if (!Object.values(ROLES).includes(newRole)) {
      throw new Error(`Rôle cible invalide: ${newRole}`);
    }

    // Vérifier que l'utilisateur peut effectuer cette transition
    if (!this.canPerformAction(requestingUser.role, 'CHANGE_ROLE')) {
      throw new Error(`${requestingUser.role} ne peut pas changer les rôles`);
    }

    // Vérifier que l'utilisateur peut assigner le nouveau rôle
    const assignableRoles = this.getAssignableRoles(requestingUser.role);
    if (!assignableRoles.includes(newRole)) {
      throw new Error(`${requestingUser.role} ne peut pas assigner le rôle ${newRole}`);
    }

    console.log('✅ Transition de rôle valide');
    return true;
  }

  /**
   * Obtenir les statistiques des rôles
   */
  static async getRoleStatistics() {
    console.log('📊 getRoleStatistics');

    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            active: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            inactive: {
              $sum: { $cond: ['$isActive', 0, 1] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      console.log('✅ Statistiques récupérées:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      throw error;
    }
  }

  /**
   * Obtenir les utilisateurs par rôle
   */
  static async getUsersByRole(role, filters = {}) {
    console.log('👥 getUsersByRole:', { role, filters });

    try {
      const query = { role };

      if (filters.agence) {
        query.agence = filters.agence;
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      const users = await User.find(query)
        .select('-password -otpSecret')
        .sort({ createdAt: -1 });

      console.log('✅ Utilisateurs trouvés:', users.length);
      return users;
    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
      throw error;
    }
  }
}

module.exports = RoleManagementService;
