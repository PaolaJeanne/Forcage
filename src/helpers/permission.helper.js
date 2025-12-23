// src/helpers/permission.helper.js - VERSION CORRIGÉE (une seule déclaration)
const { PERMISSIONS, LIMITES_AUTORISATION, HIERARCHY } = require('../constants/roles');

class PermissionHelper {
  
  /**
   * Vérifier si un rôle a une permission
   */
  static hasPermission(userRole, permission) {
    console.log(`🔍 hasPermission - Role: ${userRole}, Permission: ${permission}`);
    
    if (!PERMISSIONS[permission]) {
      console.warn(`⚠️ Permission inconnue: ${permission}`);
      return false;
    }
    
    const hasPerm = PERMISSIONS[permission].includes(userRole);
    console.log(`📊 Résultat: ${hasPerm ? '✅' : '❌'} ${hasPerm}`);
    return hasPerm;
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
    console.log(`🔍 hasAnyPermission - Role: ${userRole}, Permissions: ${permissions.join(', ')}`);
    const result = permissions.some(permission => this.hasPermission(userRole, permission));
    console.log(`📊 Résultat: ${result ? '✅' : '❌'} ${result}`);
    return result;
  }
  
  /**
   * Vérifier plusieurs permissions (ET logique)
   */
  static hasAllPermissions(userRole, permissions) {
    console.log(`🔍 hasAllPermissions - Role: ${userRole}, Permissions: ${permissions.join(', ')}`);
    const result = permissions.every(permission => this.hasPermission(userRole, permission));
    console.log(`📊 Résultat: ${result ? '✅' : '❌'} ${result}`);
    return result;
  }
  
  /**
   * Vérifier la limite d'autorisation - VERSION CORRIGÉE
   */
  static canAuthorizeMontant(userRole, montant) {
    console.log(`\n💰 canAuthorizeMontant - Role: ${userRole}, Montant: ${montant}`);
    
    // Vérifier que montant est un nombre valide
    if (isNaN(montant) || montant < 0) {
      console.log(`❌ Montant invalide: ${montant}`);
      return false;
    }
    
    const montantNum = Number(montant);
    
    // Rôles sans limite (admin, dga)
    if (['admin', 'dga'].includes(userRole)) {
      console.log(`✅ Rôle ${userRole} - Pas de limite (admin/dga)`);
      return true;
    }
    
    // Vérifier si le rôle a une limite définie
    if (LIMITES_AUTORISATION[userRole] === undefined) {
      console.log(`❌ Limite non définie pour le rôle: ${userRole}`);
      return false;
    }
    
    const limite = LIMITES_AUTORISATION[userRole];
    const result = montantNum <= limite;
    
    console.log(`📊 Limite pour ${userRole}: ${limite === Infinity ? 'Infini' : limite}`);
    console.log(`📊 Vérification: ${montantNum} <= ${limite === Infinity ? 'Infini' : limite} = ${result}`);
    
    return result;
  }
  
  /**
   * Vérifier si un utilisateur peut accéder à une demande
   */
  static canAccessDemande(user, demande) {
    console.log(`\n🔍 canAccessDemande - User: ${user.email}, Demande: ${demande._id}`);
    
    // Admin, DGA : accès total
    if (this.hasPermission(user.role, 'VIEW_ALL_DEMANDES')) {
      console.log('✅ Accès VIEW_ALL_DEMANDES');
      return true;
    }
    
    // Client : uniquement ses demandes
    if (user.role === 'client') {
      const clientId = demande.clientId?._id || demande.clientId;
      const isOwner = clientId.toString() === user.id.toString();
      console.log(`📊 Client vérification: ${isOwner ? '✅ Propriétaire' : '❌ Non propriétaire'}`);
      return isOwner;
    }
    
    // Conseiller : demandes assignées + agence
    if (user.role === 'conseiller') {
      const conseillerId = demande.conseillerId?._id || demande.conseillerId;
      const isAssigned = conseillerId?.toString() === user.id.toString();
      const sameAgency = demande.agenceId === user.agence;
      
      console.log(`📊 Conseiller vérification:`);
      console.log(`   - Assigné: ${isAssigned ? '✅' : '❌'}`);
      console.log(`   - Même agence: ${sameAgency ? '✅' : '❌'}`);
      
      return isAssigned || sameAgency;
    }
    
    // RM, DCE, ADG : leur agence
    if (this.hasPermission(user.role, 'VIEW_AGENCY_DEMANDES')) {
      const sameAgency = demande.agenceId === user.agence;
      console.log(`📊 Agence vérification: ${sameAgency ? '✅ Même agence' : '❌ Agence différente'}`);
      return sameAgency;
    }
    
    console.log('❌ Aucun critère d\'accès rempli');
    return false;
  }
  
  /**
   * Obtenir le niveau hiérarchique
   */
  static getHierarchyLevel(role) {
    // HIERARCHY est un tableau : ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin']
    const level = HIERARCHY.indexOf(role);
    console.log(`📊 HierarchyLevel - ${role}: niveau ${level}`);
    return level;
  }
  
  /**
   * Vérifier si roleA est supérieur à roleB
   */
  static isHigherRole(roleA, roleB) {
    const levelA = this.getHierarchyLevel(roleA);
    const levelB = this.getHierarchyLevel(roleB);
    const result = levelA > levelB;
    
    console.log(`📊 isHigherRole - ${roleA}(${levelA}) > ${roleB}(${levelB}) = ${result ? '✅' : '❌'} ${result}`);
    
    return result;
  }
  
  /**
   * Construire la query selon le rôle
   */
  static buildQueryForRole(user, filters = {}) {
    console.log(`\n🔍 buildQueryForRole - User: ${user.email}, Role: ${user.role}`);
    
    let query = {};
    
    // Selon les permissions
    if (this.hasPermission(user.role, 'VIEW_ALL_DEMANDES')) {
      console.log('📊 Query: Accès à toutes les demandes');
      // Pas de filtre supplémentaire
    } else if (this.hasPermission(user.role, 'VIEW_AGENCY_DEMANDES')) {
      console.log(`📊 Query: Filtre par agence: ${user.agence}`);
      query.agenceId = user.agence;
    } else if (this.hasPermission(user.role, 'VIEW_TEAM_DEMANDES')) {
      if (user.role === 'conseiller') {
        console.log(`📊 Query: Conseiller - par conseillerId ou agence`);
        query.$or = [
          { conseillerId: user.id },
          { agenceId: user.agence }
        ];
      } else {
        console.log(`📊 Query: Équipe - par agence: ${user.agence}`);
        query.agenceId = user.agence;
      }
    } else if (this.hasPermission(user.role, 'VIEW_OWN_DEMANDE')) {
      console.log(`📊 Query: Client - uniquement ses demandes`);
      query.clientId = user.id;
    } else {
      console.log(`❌ Aucune permission VIEW pour le rôle: ${user.role}`);
      return { _id: null }; // Retourner une query qui ne retournera rien
    }
    
    // Appliquer les filtres additionnels
    if (filters.statut) {
      query.statut = filters.statut;
      console.log(`📊 + Filtre statut: ${filters.statut}`);
    }
    if (filters.typeOperation) {
      query.typeOperation = filters.typeOperation;
      console.log(`📊 + Filtre typeOperation: ${filters.typeOperation}`);
    }
    if (filters.scoreRisque) {
      query.scoreRisque = filters.scoreRisque;
      console.log(`📊 + Filtre scoreRisque: ${filters.scoreRisque}`);
    }
    
    if (filters.dateDebut || filters.dateFin) {
      query.createdAt = {};
      if (filters.dateDebut) {
        query.createdAt.$gte = new Date(filters.dateDebut);
        console.log(`📊 + Filtre dateDebut: ${filters.dateDebut}`);
      }
      if (filters.dateFin) {
        query.createdAt.$lte = new Date(filters.dateFin);
        console.log(`📊 + Filtre dateFin: ${filters.dateFin}`);
      }
    }
    
    console.log(`📋 Query final:`, JSON.stringify(query, null, 2));
    return query;
  }
  
  /**
   * Obtenir les widgets disponibles selon le rôle
   */
  static getAvailableWidgets(role) {
    console.log(`\n🔍 getAvailableWidgets - Role: ${role}`);
    
    const widgets = [];
    
    // Widgets de base
    if (this.hasPermission(role, 'VIEW_DASHBOARD')) {
      console.log('📊 Ajout widgets dashboard de base');
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
      console.log('📊 Ajout widgets équipe');
      widgets.push(
        { id: 'kpi-montant-total', type: 'kpi', title: 'Montant total', icon: 'dollar-sign', size: 'small' },
        { id: 'kpi-montant-moyen', type: 'kpi', title: 'Montant moyen', icon: 'trending-up', size: 'small' },
        { id: 'chart-evolution', type: 'chart', title: 'Évolution mensuelle', chartType: 'line', size: 'large' }
      );
    }
    
    // Widgets d'agence
    if (this.hasPermission(role, 'VIEW_AGENCY_DASHBOARD')) {
      console.log('📊 Ajout widgets agence');
      widgets.push(
        { id: 'kpi-clients-actifs', type: 'kpi', title: 'Clients actifs', icon: 'users', size: 'small' },
        { id: 'chart-par-conseiller', type: 'chart', title: 'Performance conseillers', chartType: 'bar', size: 'large' },
        { id: 'list-top-clients', type: 'list', title: 'Top clients', size: 'medium' }
      );
    }
    
    // Widgets de risque
    if (this.hasPermission(role, 'VIEW_RISK_STATS')) {
      console.log('📊 Ajout widgets risque');
      widgets.push(
        { id: 'kpi-risque-eleve', type: 'kpi', title: 'Demandes à risque', icon: 'alert-triangle', size: 'small' },
        { id: 'chart-risques', type: 'chart', title: 'Répartition risques', chartType: 'doughnut', size: 'medium' },
        { id: 'list-alertes', type: 'list', title: 'Alertes risques', size: 'medium' }
      );
    }
    
    // Widgets admin
    if (this.hasPermission(role, 'VIEW_GLOBAL_DASHBOARD')) {
      console.log('📊 Ajout widgets global');
      widgets.push(
        { id: 'kpi-utilisateurs', type: 'kpi', title: 'Utilisateurs actifs', icon: 'user-check', size: 'small' },
        { id: 'chart-par-agence', type: 'chart', title: 'Performance agences', chartType: 'bar', size: 'large' }
      );
    }
    
    if (this.hasPermission(role, 'VIEW_AUDIT')) {
      console.log('📊 Ajout widgets audit');
      widgets.push(
        { id: 'list-audit', type: 'list', title: 'Logs audit', size: 'large' }
      );
    }
    
    console.log(`📋 Total widgets: ${widgets.length}`);
    return widgets;
  }
  
  /**
   * Obtenir le niveau d'approbation suivant
   */
  static getNextApprover(montant, currentRole) {
    console.log(`\n🔍 getNextApprover - Montant: ${montant}, Role actuel: ${currentRole}`);
    
    const currentIndex = HIERARCHY.indexOf(currentRole);
    
    if (currentIndex === -1) {
      console.log('⚠️ Rôle actuel non trouvé dans HIERARCHY');
      return 'admin';
    }
    
    // Chercher le prochain niveau qui peut autoriser ce montant
    for (let i = currentIndex + 1; i < HIERARCHY.length; i++) {
      const role = HIERARCHY[i];
      const limite = LIMITES_AUTORISATION[role];
      
      console.log(`📊 Test rôle ${role} - Limite: ${limite}`);
      
      if (limite !== undefined && montant <= limite) {
        console.log(`✅ Prochain approbateur trouvé: ${role}`);
        return role;
      }
    }
    
    console.log('⚠️ Aucun approbateur trouvé, retour DGA par défaut');
    return 'dga';
  }
}

module.exports = PermissionHelper;