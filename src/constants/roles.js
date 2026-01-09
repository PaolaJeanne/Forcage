/**
 * src/constants/roles.js - Gestion complète des rôles et permissions
 * VERSION CORRIGÉE ET BIEN APPLIQUÉE
 */

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
    BROUILLON: 'BROUILLON',                    // En cours de rédaction
    ENVOYEE: 'ENVOYEE',                        // Soumise par client
    
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

  // ========== TRANSITIONS DE STATUT AUTORISÉES PAR RÔLE ==========
  TRANSITIONS_PAR_ROLE: {
    client: {
      BROUILLON: ['ENVOYEE', 'ANNULEE'],
      ENVOYEE: ['ANNULEE']
    },
    conseiller: {
      EN_ATTENTE_CONSEILLER: ['EN_ETUDE_CONSEILLER', 'REJETEE'],
      EN_ETUDE_CONSEILLER: ['EN_ATTENTE_RM', 'EN_ANALYSE_RISQUES', 'REJETEE']
    },
    rm: {
      EN_ATTENTE_RM: ['EN_ATTENTE_DCE', 'APPROUVEE', 'REJETEE'],
      EN_ETUDE_CONSEILLER: ['EN_ATTENTE_RM', 'EN_ANALYSE_RISQUES', 'REJETEE']
    },
    dce: {
      EN_ATTENTE_DCE: ['EN_ATTENTE_ADG', 'APPROUVEE', 'REJETEE']
    },
    adg: {
      EN_ATTENTE_ADG: ['APPROUVEE', 'REJETEE', 'EN_ANALYSE_RISQUES']
    },
    risques: {
      EN_ANALYSE_RISQUES: ['APPROUVEE', 'REJETEE']
    },
    dga: {
      EN_ATTENTE_ADG: ['APPROUVEE', 'REJETEE'],
      EN_ANALYSE_RISQUES: ['APPROUVEE', 'REJETEE']
    },
    admin: {
      '*': ['APPROUVEE', 'REJETEE', 'ANNULEE', 'DECAISSEE', 'REGULARISEE', 'EN_SUIVI']
    }
  },

  // ========== ACTIONS POSSIBLES ==========
  ACTIONS_DEMANDE: {
    // Client
    SOUMETTRE: 'SOUMETTRE',       // Soumettre une demande
    ANNULER: 'ANNULER',           // Annuler sa demande
    
    // Traitement
    PRENDRE_EN_CHARGE: 'PRENDRE_EN_CHARGE', // Prendre en charge le dossier
    VALIDER: 'VALIDER',           // Approuver à un niveau
    REJETER: 'REJETER',           // Rejeter à un niveau
    REMONTER: 'REMONTER',         // Remonter au niveau supérieur
    RETOURNER: 'RETOURNER',       // Retourner pour complément
    
    // Exécution
    DECAISSER: 'DECAISSER',       // Débloquer les fonds
    REGULARISER: 'REGULARISER'    // Marquer comme remboursée
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
    AUTO: 'AUTO',
    CONSOMMATION: 'CONSOMMATION',
    FONDS_ROULEMENT: 'FONDS_ROULEMENT',
    URGENCE_TRESORERIE: 'URGENCE_TRESORERIE',
    AUTRE: 'AUTRE'
  },

  // ========== PERMISSIONS PAR RÔLE ==========
  PERMISSIONS: {
    // ========== DEMANDES ==========
    CREATE_DEMANDE: ['client'],
    VIEW_OWN_DEMANDE: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'admin', 'risques'],
    CANCEL_OWN_DEMANDE: ['client'],
    VALIDATE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'admin', 'risques'],
    REFUSE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'admin', 'risques'],
    ESCALATE_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'admin'],
    PROCESS_DEMANDE: ['conseiller', 'rm', 'dce', 'adg', 'admin', 'risques'],
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
    DELETE_DOCUMENTS: ['admin', 'dga'],

    // ========== KYC ==========
    SUBMIT_KYC: ['client'],
    VIEW_KYC: ['admin', 'dga', 'risques'],
    APPROVE_KYC: ['admin', 'dga'],
    REJECT_KYC: ['admin', 'dga']
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
      NOTATION_MAX: 'C'     // Notation C ou pire
    },

    // Règles d'assignation automatique
    ASSIGNATION_AUTO: {
      AGENCE_PAR_DEFAUT: 'Agence Centrale',
      CONSEILLER_PAR_DEFAUT: null // null = premier conseiller disponible
    }
  },

  // ========== VALIDATION DES AGENCES PAR RÔLE ==========
  AGENCY_VALIDATION: {
    // Rôles qui doivent avoir une agence
    REQUIRES_AGENCY: ['conseiller', 'rm', 'dce', 'adg', 'risques'],
    
    // Rôles qui peuvent avoir une agence optionnelle
    OPTIONAL_AGENCY: ['dga', 'admin'],
    
    // Rôles qui ne doivent PAS avoir d'agence
    NO_AGENCY: ['client']
  },

  // ========== FONCTIONS UTILITAIRES ==========
  /**
   * Vérifier si un rôle peut effectuer une action
   */
  canPerformAction: function(role, action) {
    const permission = this.PERMISSIONS[action];
    return permission && permission.includes(role);
  },

  /**
   * Vérifier si une transition de statut est autorisée
   */
  isTransitionAllowed: function(role, currentStatus, newStatus) {
    const transitions = this.TRANSITIONS_PAR_ROLE[role];
    if (!transitions) return false;
    
    // Vérifier les transitions spécifiques
    if (transitions[currentStatus]) {
      return transitions[currentStatus].includes(newStatus);
    }
    
    // Vérifier les transitions génériques (*)
    if (transitions['*']) {
      return transitions['*'].includes(newStatus);
    }
    
    return false;
  },

  /**
   * Obtenir la limite d'autorisation pour un rôle
   */
  getLimiteAutorisation: function(role) {
    return this.LIMITES_AUTORISATION[role] || 0;
  },

  /**
   * Vérifier si un montant est autorisé pour un rôle
   */
  isMontantAuthorized: function(role, montant) {
    const limite = this.getLimiteAutorisation(role);
    return montant <= limite;
  },

  /**
   * Obtenir le niveau de risque basé sur la notation et le montant
   */
  getRiskLevel: function(notation, montant) {
    if (notation === 'A' && montant <= 500000) return this.RISK_LEVELS.FAIBLE;
    if (['B', 'C'].includes(notation) && montant <= 2000000) return this.RISK_LEVELS.MOYEN;
    if (notation === 'D' && montant <= 5000000) return this.RISK_LEVELS.ELEVE;
    return this.RISK_LEVELS.CRITIQUE;
  }
};
