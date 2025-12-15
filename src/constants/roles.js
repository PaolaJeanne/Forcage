
// ============================================
// 2. CONSTANTS - src/constants/roles.js
// ============================================
module.exports = {
  ROLES: {
    CLIENT: 'client',
    CONSEILLER: 'conseiller',
    RM: 'rm',
    DCE: 'dce',
    ADG: 'adg',
    DGA: 'dga',
    RISQUES: 'risques',
    ADMIN: 'admin'
  },
  
  LIMITES_AUTORISATION: {
    conseiller: 500000,
    rm: 2000000,
    dce: 5000000,
    adg: 10000000,
    dga: Infinity,
    admin: Infinity
  },
  
  PERMISSIONS: {
    CREATE_DEMANDE: ['client'],
    VIEW_OWN_DEMANDE: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    CANCEL_OWN_DEMANDE: ['client'],
    
    PROCESS_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    VALIDATE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    REFUSE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    
    VIEW_DASHBOARD: ['rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_ALL_DEMANDES: ['dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_STATISTICS: ['rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    EXPORT_DATA: ['dce', 'adg', 'dga', 'admin'],
    
    MANAGE_USERS: ['admin'],
    MANAGE_SETTINGS: ['admin', 'dga'],
    VIEW_AUDIT: ['adg', 'dga', 'risques', 'admin']
  }
};
