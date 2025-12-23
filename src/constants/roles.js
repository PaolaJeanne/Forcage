// src/constants/roles.js - VERSION COMPLÈTE AVEC WORKFLOW RÉEL
module.exports = {
  // ========== RÔLES UTILISATEURS ==========
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
  
  // ========== HIÉRARCHIE POUR ESCALADE ==========
  HIERARCHY: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'],
  
  // ========== LIMITES D'AUTORISATION RÉELLES (FCFA) ==========
  LIMITES_AUTORISATION: {
    client: 0,
    conseiller: 500000,      // 500K FCFA
    rm: 2000000,             // 2M FCFA
    dce: 5000000,            // 5M FCFA
    adg: 10000000,           // 10M FCFA
    dga: Infinity,
    admin: Infinity,
    risques: 0 // Service risques n'autorise pas, seulement analyse
  },
  
  // ========== STATUTS DEMANDE (WORKFLOW RÉEL) ==========
  STATUTS_DEMANDE: {
    // Phase client
    BROUILLON: 'BROUILLON',           // En cours de rédaction
    ENVOYEE: 'ENVOYEE',               // Soumise par client (statut temporaire)
    
    // Phase conseiller
    EN_ATTENTE_CONSEILLER: 'EN_ATTENTE_CONSEILLER', // À traiter par conseiller
    EN_ETUDE_CONSEILLER: 'EN_ETUDE_CONSEILLER',     // En cours d'étude
    
    // Phase hiérarchique
    EN_ATTENTE_RM: 'EN_ATTENTE_RM',     // Remontée au Responsable d'Agence
    EN_ATTENTE_DCE: 'EN_ATTENTE_DCE',   // Remontée au Directeur Commercial
    EN_ATTENTE_ADG: 'EN_ATTENTE_ADG',   // Remontée à l'ADG
    
    // Phase analyse risques
    EN_ANALYSE_RISQUES: 'EN_ANALYSE_RISQUES', // Service risques
    
    // Décision
    APPROUVEE: 'APPROUVEE',             // Validée
    REJETEE: 'REJETEE',                 // Refusée
    
    // Exécution
    DECAISSEE: 'DECAISSEE',             // Fonds débloqués
    EN_SUIVI: 'EN_SUIVI',               // En cours de suivi
    
    // Clôture
    REGULARISEE: 'REGULARISEE',         // Remboursée
    ANNULEE: 'ANNULEE'                  // Annulée par le client
  },
  
  // ========== ACTIONS POSSIBLES ==========
  ACTIONS_DEMANDE: {
    // Client
    SOUMETTRE: 'SOUMETTRE',   // Soumettre une demande
    ANNULER: 'ANNULER',       // Annuler sa demande
    
    // Traitement
    VALIDER: 'VALIDER',       // Approuver à un niveau
    REJETER: 'REJETER',       // Rejeter à un niveau
    REMONTER: 'REMONTER',     // Remonter au niveau supérieur
    RETOURNER: 'RETOURNER',   // Retourner pour complément
    
    // Exécution
    DECAISSER: 'DECAISSER',   // Débloquer les fonds
    REGULARISER: 'REGULARISER' // Marquer comme remboursée
  },
  
  // ========== TRANSITIONS DE STATUT AUTORISÉES ==========
  TRANSITIONS_AUTORISEES: {
    BROUILLON: ['ENVOYEE', 'ANNULEE'],
    ENVOYEE: ['EN_ATTENTE_CONSEILLER', 'ANNULEE'],
    EN_ATTENTE_CONSEILLER: ['EN_ETUDE_CONSEILLER', 'EN_ATTENTE_RM', 'REJETEE', 'RETOURNER'],
    EN_ETUDE_CONSEILLER: ['EN_ATTENTE_CONSEILLER', 'EN_ATTENTE_RM', 'EN_ANALYSE_RISQUES', 'APPROUVEE', 'REJETEE'],
    EN_ATTENTE_RM: ['EN_ATTENTE_DCE', 'APPROUVEE', 'REJETEE', 'RETOURNER'],
    EN_ATTENTE_DCE: ['EN_ATTENTE_ADG', 'APPROUVEE', 'REJETEE', 'RETOURNER'],
    EN_ATTENTE_ADG: ['APPROUVEE', 'REJETEE', 'RETOURNER'],
    EN_ANALYSE_RISQUES: ['APPROUVEE', 'REJETEE'],
    APPROUVEE: ['DECAISSEE'],
    DECAISSEE: ['EN_SUIVI'],
    EN_SUIVI: ['REGULARISEE'],
    REJETEE: [], // Statut final
    REGULARISEE: [], // Statut final
    ANNULEE: [] // Statut final
  },
  
  // ========== NOTATIONS CLIENT ==========
  NOTATIONS_CLIENT: {
    A: 'A', // Excellent - historique impeccable
    B: 'B', // Bon - quelques retards mineurs
    C: 'C', // Moyen - retards occasionnels
    D: 'D', // À surveiller - difficultés de trésorerie
    E: 'E'  // Risqué - nombreux incidents
  },
  
  // ========== PRIORITÉS ==========
  PRIORITES: {
    URGENTE: 'URGENTE',   // Traitement sous 24h
    HAUTE: 'HAUTE',       // Traitement sous 72h
    NORMALE: 'NORMALE'    // Traitement sous 5 jours
  },
  
  // ========== NIVEAUX DE RISQUE ==========
  RISK_LEVELS: {
    FAIBLE: 'FAIBLE',     // Notation A, montant ≤ 500K
    MOYEN: 'MOYEN',       // Notation B/C, montant ≤ 2M
    ELEVE: 'ELEVE',       // Notation D, montant ≤ 5M
    CRITIQUE: 'CRITIQUE'  // Notation E, montant > 5M
  },
  
  // ========== TYPES D'OPÉRATION ==========
  TYPES_OPERATION: {
    VIREMENT: 'VIREMENT',
    CHEQUE: 'CHEQUE',
    EQUIPEMENT: 'EQUIPEMENT',
    IMMOBILIER: 'IMMOBILIER',
    FONDS_ROULEMENT: 'FONDS_ROULEMENT',
    URGENCE_TRESORERIE: 'URGENCE_TRESORERIE',
    AUTRE: 'AUTRE'
  },
  
  // ========== PERMISSIONS (GARDÉES POUR COMPATIBILITÉ) ==========
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
  
  // ========== CONFIGURATION WORKFLOW ==========
  WORKFLOW_CONFIG: {
    // Délais de traitement (en heures)
    DELAIS_TRAITEMENT: {
      URGENTE: 24,
      HAUTE: 72,
      NORMALE: 120
    },
    
    // Seuils pour analyse risques automatique
    SEUILS_ANALYSE_RISQUES: {
      MONTANT_MIN: 1000000, // 1M FCFA
      NOTATION_MAX: 'C' // Notation C ou pire
    },
    
    // Règles d'assignation automatique
    ASSIGNATION_AUTO: {
      AGENCE_PAR_DEFAUT: 'Agence Centrale',
      CONSEILLER_PAR_DEFAUT: null // null = premier conseiller disponible
    }
  }
};