// src/constants/roles.js
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
    conseiller: 500000,      // 500K FCFA
    rm: 2000000,             // 2M FCFA
    dce: 5000000,            // 5M FCFA
    adg: 10000000,           // 10M FCFA
    dga: Infinity,
    admin: Infinity
  },
  
  PERMISSIONS: {
    // ========== DEMANDES ==========
    CREATE_DEMANDE: ['client'],
    VIEW_OWN_DEMANDE: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    CANCEL_OWN_DEMANDE: ['client'],
    
    PROCESS_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    VALIDATE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    REFUSE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    ESCALATE_DEMANDE: ['conseiller', 'rm', 'dce'],
    
    VIEW_ALL_DEMANDES: ['dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_TEAM_DEMANDES: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    VIEW_AGENCY_DEMANDES: ['rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    
    // ========== DASHBOARD ==========
    VIEW_DASHBOARD: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_OWN_DASHBOARD: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_TEAM_DASHBOARD: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    VIEW_AGENCY_DASHBOARD: ['rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    VIEW_GLOBAL_DASHBOARD: ['dga', 'admin', 'risques'],
    
    // ========== STATISTIQUES ==========
    VIEW_STATISTICS: ['rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_BASIC_STATS: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    VIEW_ADVANCED_STATS: ['rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    VIEW_RISK_STATS: ['risques', 'adg', 'dga', 'admin'],
    EXPORT_DATA: ['dce', 'adg', 'dga', 'admin'],
    
    // ========== UTILISATEURS ==========
    MANAGE_USERS: ['admin'],
    VIEW_USERS: ['rm', 'dce', 'adg', 'dga', 'admin'],
    CREATE_USER: ['admin', 'dga'],
    UPDATE_USER: ['admin', 'dga'],
    DELETE_USER: ['admin'],
    
    // ========== NOTIFICATIONS ==========
    VIEW_NOTIFICATIONS: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    SEND_NOTIFICATIONS: ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    MANAGE_NOTIFICATION_TEMPLATES: ['admin', 'dga'],
    
    // ========== SYSTÈME ==========
    MANAGE_SETTINGS: ['admin', 'dga'],
    VIEW_AUDIT: ['adg', 'dga', 'risques', 'admin'],
    MANAGE_AUDIT: ['admin'],
    VIEW_LOGS: ['admin', 'dga', 'risques'],
    
    // ========== DOCUMENTS ==========
    UPLOAD_DOCUMENTS: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
    VIEW_DOCUMENTS: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    DELETE_DOCUMENTS: ['admin', 'dga']
  },
  
  // Hiérarchie pour escalade
  HIERARCHY: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
  
  // Niveaux de risque
  RISK_LEVELS: {
    FAIBLE: 'FAIBLE',
    MOYEN: 'MOYEN',
    ELEVE: 'ELEVE',
    CRITIQUE: 'CRITIQUE'
  }
};