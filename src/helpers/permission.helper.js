// src/helpers/permission.helper.js
const { PERMISSIONS, LIMITES_AUTORISATION, HIERARCHY } = require('../constants/roles');

class PermissionHelper {
  
  /**
   * Vérifier si un rôle a une permission
   */
  static hasPermission(userRole, permission) {
    if (!PERMISSIONS[permission]) {
      console.warn(`⚠️ Permission inconnue: ${permission}`);
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
   * Vérifier si un utilisateur peut accéder à une demande
   */
  static canAccessDemande(user, demande) {
    // Admin, DGA, Risques : accès total
    if (this.hasPermission(user.role, 'VIEW_ALL_DEMANDES')) {
      return true;
    }
    
    // Client : uniquement ses demandes
    if (user.role === 'client') {
      const clientId = demande.clientId?._id || demande.clientId;
      return clientId.toString() === user.id.toString();
    }
    
    // Conseiller : demandes assignées + agence
    if (user.role === 'conseiller') {
      const conseillerId = demande.conseillerId?._id || demande.conseillerId;
      return conseillerId?.toString() === user.id.toString() || 
             demande.agenceId === user.agence;
    }
    
    // RM, DCE, ADG : leur agence
    if (this.hasPermission(user.role, 'VIEW_AGENCY_DEMANDES')) {
      return demande.agenceId === user.agence;
    }
    
    return false;
  }
  
  /**
   * Vérifier la limite d'autorisation
   */
  static canAuthorizeMontant(userRole, montant) {
    const limite = LIMITES_AUTORISATION[userRole];
    
    if (limite === undefined) {
      return false;
    }
    
    return montant <= limite;
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
    
    return 'dga'; // Par défaut, remonter au DGA
  }
  
  /**
   * Construire la query selon le rôle
   */
  static buildQueryForRole(user, filters = {}) {
    let query = {};
    
    // Selon les permissions
    if (this.hasPermission(user.role, 'VIEW_ALL_DEMANDES')) {
      // Accès à toutes les données
    } else if (this.hasPermission(user.role, 'VIEW_AGENCY_DEMANDES')) {
      query.agenceId = user.agence;
    } else if (this.hasPermission(user.role, 'VIEW_TEAM_DEMANDES')) {
      if (user.role === 'conseiller') {
        query.$or = [
          { conseillerId: user.id },
          { agenceId: user.agence }
        ];
      }
    } else if (this.hasPermission(user.role, 'VIEW_OWN_DEMANDE')) {
      query.clientId = user.id;
    }
    
    // Appliquer les filtres additionnels
    if (filters.statut) query.statut = filters.statut;
    if (filters.typeOperation) query.typeOperation = filters.typeOperation;
    if (filters.scoreRisque) query.scoreRisque = filters.scoreRisque;
    
    if (filters.dateDebut || filters.dateFin) {
      query.createdAt = {};
      if (filters.dateDebut) query.createdAt.$gte = new Date(filters.dateDebut);
      if (filters.dateFin) query.createdAt.$lte = new Date(filters.dateFin);
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
   * Obtenir le niveau hiérarchique
   */
  static getHierarchyLevel(role) {
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
}

module.exports = PermissionHelper;