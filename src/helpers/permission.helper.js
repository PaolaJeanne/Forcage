// src/helpers/permission.helper.js - VERSION CORRIGÉE (une seule déclaration)
const { PERMISSIONS, LIMITES_AUTORISATION, HIERARCHY } = require('../constants/roles');

class PermissionHelper {

  /**
   * Vérifier si un rôle a une permission
   */
  static hasPermission(userRole, permission) {
    if (!PERMISSIONS[permission]) {
      return false;
    }

    return PERMISSIONS[permission].includes(userRole);
  }

  /**
   * Obtenir toutes les permissions d'un rôle
   */
  static getRolePermissions(role) {
    const permissions = [];
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      if (roles.includes(role)) {
        permissions.push(permission);
      }
    }
    return permissions;
  }

  /**
   * Vérifier plusieurs permissions (OU logique)
   */
  static hasAnyPermission(userRole, permissions) {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Vérifier plusieurs permissions (ET logique)
   */
  static hasAllPermissions(userRole, permissions) {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Vérifier la limite d'autorisation - VERSION CORRIGÉE
   */
  static canAuthorizeMontant(userRole, montant) {

    // Vérifier que montant est un nombre valide
    if (isNaN(montant) || montant < 0) {
      return false;
    }

    const montantNum = Number(montant);

    // Rôles sans limite (admin, dga)
    if (['admin', 'dga'].includes(userRole)) {
      return true;
    }

    // Vérifier si le rôle a une limite définie
    if (LIMITES_AUTORISATION[userRole] === undefined) {
      return false;
    }

    const limite = LIMITES_AUTORISATION[userRole];
    return montantNum <= limite;
  }

  /**
   * Vérifier si un utilisateur peut accéder à une demande
   * VERSION CORRIGÉE avec support agencyId/agence
   */
  static canAccessDemande(user, demande) {

    // Admin, DGA : accès total
    if (this.hasPermission(user.role, 'VIEW_ALL_DEMANDES')) {
      return true;
    }

    // Client : uniquement ses demandes
    if (user.role === 'client') {
      const clientId = demande.clientId?._id || demande.clientId;
      const isOwner = clientId.toString() === user.id.toString();
      return isOwner;
    }

    // Service risques : voir les demandes en analyse
    if (user.role === 'risques') {
      return demande.statut === 'EN_ANALYSE_RISQUES';
    }

    // Vérifier par agencyId d'abord (plus précis)
    if (user.agencyId && demande.agencyId) {
      const sameAgencyById = demande.agencyId.toString() === user.agencyId.toString();
      if (sameAgencyById) {
        return true;
      }
    }

    // Fallback sur le nom de l'agence (pour compatibilité)
    if (user.agence && demande.agence) {
      const sameAgencyByName = demande.agence === user.agence;
      if (sameAgencyByName) {
        return true;
      }
    }

    // Conseiller : demandes assignées
    if (user.role === 'conseiller') {
      const conseillerId = demande.conseillerId?._id || demande.conseillerId;
      const isAssigned = conseillerId?.toString() === user.id.toString();
      return isAssigned;
    }

    return false;
  }

  /**
   * Obtenir le niveau hiérarchique
   */
  static getHierarchyLevel(role) {
    // HIERARCHY est un tableau : ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin']
    return HIERARCHY.indexOf(role);
  }

  /**
   * Vérifier si roleA est supérieur à roleB
   */
  static isHigherRole(roleA, roleB) {
    const levelA = this.getHierarchyLevel(roleA);
    const levelB = this.getHierarchyLevel(roleB);
    return levelA > levelB;
  }

  /**
   * Construire la query selon le rôle
   * VERSION CORRIGÉE avec support agencyId/agence
   */
  static buildQueryForRole(user, filters = {}) {
    let query = {};

    // Selon les permissions
    if (this.hasPermission(user.role, 'VIEW_ALL_DEMANDES')) {
      // Pas de filtre supplémentaire pour admin/dga
    } else if (this.hasPermission(user.role, 'VIEW_AGENCY_DEMANDES')) {
      // Utiliser agencyId si disponible, sinon agence
      if (user.agencyId) {
        query.agencyId = user.agencyId;
      } else if (user.agence) {
        query.agence = user.agence;
      }
    } else if (this.hasPermission(user.role, 'VIEW_TEAM_DEMANDES')) {
      if (user.role === 'conseiller') {
        query.$or = [
          { conseillerId: user.id },
          // Agence du conseiller
          { $and: [
            { agence: user.agence },
            { conseillerId: { $exists: false } } // Demandes non assignées
          ]}
        ];
      } else {
        // Utiliser agencyId si disponible, sinon agence
        if (user.agencyId) {
          query.agencyId = user.agencyId;
        } else if (user.agence) {
          query.agence = user.agence;
        }
      }
    } else if (this.hasPermission(user.role, 'VIEW_OWN_DEMANDE')) {
      query.clientId = user.id;
    } else {
      return { _id: null }; // Retourner une query qui ne retournera rien
    }

    // Service risques : seulement les demandes en analyse
    if (user.role === 'risques') {
      query.statut = 'EN_ANALYSE_RISQUES';
    }

    // Appliquer les filtres additionnels
    if (filters.statut) {
      query.statut = filters.statut;
    }
    if (filters.typeOperation) {
      query.typeOperation = filters.typeOperation;
    }
    if (filters.scoreRisque) {
      query.scoreRisque = filters.scoreRisque;
    }
    if (filters.conseillerId) {
      query.conseillerId = filters.conseillerId;
    }
    if (filters.clientId) {
      query.clientId = filters.clientId;
    }

    if (filters.dateDebut || filters.dateFin) {
      query.createdAt = {};
      if (filters.dateDebut) {
        query.createdAt.$gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        query.createdAt.$lte = new Date(filters.dateFin);
      }
    }

    return query;
  }

  /**
   * Obtenir les widgets disponibles selon le rôle
   */
  static getAvailableWidgets(role) {
    const widgets = [];

    // Widgets de base
    if (this.hasPermission(role, 'VIEW_DASHBOARD')) {
      widgets.push(
        { id: 'kpi-demandes-total', type: 'kpi', title: 'Total demandes', icon: 'file-text', size: 'small' },
        { id: 'kpi-demandes-en-cours', type: 'kpi', title: 'En cours', icon: 'clock', size: 'small' },
        { id: 'kpi-taux-validation', type: 'kpi', title: 'Taux validation', icon: 'check-circle', size: 'small' },
        { id: 'chart-statuts', type: 'chart', title: 'Demandes par statut', chartType: 'pie', size: 'medium' },
        { id: 'list-recent', type: 'list', title: 'Activité récente', size: 'large' }
      );
    }

    // Widgets d'équipe
    if (this.hasPermission(role, 'VIEW_TEAM_DASHBOARD')) {
      widgets.push(
        { id: 'kpi-montant-total', type: 'kpi', title: 'Montant total', icon: 'dollar-sign', size: 'small' },
        { id: 'kpi-montant-moyen', type: 'kpi', title: 'Montant moyen', icon: 'trending-up', size: 'small' },
        { id: 'chart-evolution', type: 'chart', title: 'Évolution mensuelle', chartType: 'line', size: 'large' }
      );
    }

    // Widgets d'agence
    if (this.hasPermission(role, 'VIEW_AGENCY_DASHBOARD')) {
      widgets.push(
        { id: 'kpi-clients-actifs', type: 'kpi', title: 'Clients actifs', icon: 'users', size: 'small' },
        { id: 'chart-par-conseiller', type: 'chart', title: 'Performance conseillers', chartType: 'bar', size: 'large' },
        { id: 'list-top-clients', type: 'list', title: 'Top clients', size: 'medium' }
      );
    }

    // Widgets de risque
    if (this.hasPermission(role, 'VIEW_RISK_STATS')) {
      widgets.push(
        { id: 'kpi-risque-eleve', type: 'kpi', title: 'Demandes à risque', icon: 'alert-triangle', size: 'small' },
        { id: 'chart-risques', type: 'chart', title: 'Répartition risques', chartType: 'doughnut', size: 'medium' },
        { id: 'list-alertes', type: 'list', title: 'Alertes risques', size: 'medium' }
      );
    }

    // Widgets admin
    if (this.hasPermission(role, 'VIEW_GLOBAL_DASHBOARD')) {
      widgets.push(
        { id: 'kpi-utilisateurs', type: 'kpi', title: 'Utilisateurs actifs', icon: 'user-check', size: 'small' },
        { id: 'chart-par-agence', type: 'chart', title: 'Performance agences', chartType: 'bar', size: 'large' }
      );
    }

    if (this.hasPermission(role, 'VIEW_AUDIT')) {
      widgets.push(
        { id: 'list-audit', type: 'list', title: 'Logs audit', size: 'large' }
      );
    }

    return widgets;
  }

  /**
   * Obtenir le niveau d'approbation suivant
   */
  static getNextApprover(montant, currentRole) {
    const currentIndex = HIERARCHY.indexOf(currentRole);

    if (currentIndex === -1) {
      return 'admin';
    }

    // Chercher le prochain niveau qui peut autoriser ce montant
    for (let i = currentIndex + 1; i < HIERARCHY.length; i++) {
      const role = HIERARCHY[i];
      const limite = LIMITES_AUTORISATION[role];

      if (limite !== undefined && montant <= limite) {
        return role;
      }
    }

    return 'dga';
  }

  /**
   * Vérifier si l'utilisateur peut assigner une demande
   */
  static canAssignDemande(user, demande) {
    // Seuls les conseillers, RM, DCE peuvent assigner
    if (!['conseiller', 'rm', 'dce'].includes(user.role)) {
      return false;
    }

    // Vérifier que la demande est dans la même agence
    if (user.agencyId && demande.agencyId) {
      return demande.agencyId.toString() === user.agencyId.toString();
    }

    // Fallback sur le nom de l'agence
    if (user.agence && demande.agence) {
      return demande.agence === user.agence;
    }

    return false;
  }

  /**
   * Vérifier si l'utilisateur peut valider une demande selon son niveau hiérarchique
   */
  static canValidateDemande(user, demande) {
    const userLevel = this.getHierarchyLevel(user.role);
    
    // Si c'est une demande à risque élevé, nécessite validation risques
    if (demande.scoreRisque === 'ELEVE' || demande.scoreRisque === 'CRITIQUE') {
      return user.role === 'risques';
    }

    // Selon le statut actuel
    switch (demande.statut) {
      case 'EN_ETUDE_CONSEILLER':
        return user.role === 'conseiller';
      case 'EN_ATTENTE_RM':
        return user.role === 'rm';
      case 'EN_ATTENTE_DCE':
        return user.role === 'dce';
      case 'EN_ATTENTE_ADG':
        return user.role === 'adg';
      case 'EN_ANALYSE_RISQUES':
        return user.role === 'risques';
      default:
        return false;
    }
  }
}

module.exports = PermissionHelper;