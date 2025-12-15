
// ============================================
// 3. HELPERS - src/helpers/permission.helper.js
// ============================================
const { PERMISSIONS } = require('../constants/roles');

class PermissionHelper {
  
  static hasPermission(userRole, permission) {
    const allowedRoles = PERMISSIONS[permission];
    return allowedRoles && allowedRoles.includes(userRole);
  }
  
  static getRolePermissions(role) {
    const permissions = [];
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      if (roles.includes(role)) {
        permissions.push(permission);
      }
    }
    return permissions;
  }
  
  static canAccessDemande(user, demande) {
    if (['admin', 'dga', 'risques'].includes(user.role)) {
      return true;
    }
    
    if (user.role === 'client') {
      return demande.client.toString() === user._id.toString();
    }
    
    if (['conseiller', 'rm', 'dce', 'adg'].includes(user.role)) {
      return demande.agence === user.agence;
    }
    
    return false;
  }
  
  static getNextApprover(montant, currentLevel) {
    const { LIMITES_AUTORISATION } = require('../constants/roles');
    
    const hierarchie = ['conseiller', 'rm', 'dce', 'adg', 'dga'];
    const currentIndex = hierarchie.indexOf(currentLevel);
    
    for (let i = currentIndex; i < hierarchie.length; i++) {
      const level = hierarchie[i];
      if (montant <= LIMITES_AUTORISATION[level]) {
        return level;
      }
    }
    
    return 'dga';
  }
}

module.exports = PermissionHelper;
