// src/services/workflow.service.js - VERSION CORRIGÉE
const {
  STATUTS_DEMANDE,
  ACTIONS_DEMANDE,
  LIMITES_AUTORISATION,
  HIERARCHY,
  NOTATIONS_CLIENT,
  TRANSITIONS_AUTORISEES,
  WORKFLOW_CONFIG
} = require('../constants/roles');

class WorkflowService {

  /**
   * Déterminer le prochain statut selon l'action et le contexte
   */
  static getNextStatus(action, currentStatus, montant, userRole, notationClient, agence) {


    // Vérifier si la transition est autorisée
    const transitions = TRANSITIONS_AUTORISEES[currentStatus] || [];
    if (!transitions.length) {

      return currentStatus;
    }

    switch (action) {
      // ========== ACTIONS CLIENT ==========
      case ACTIONS_DEMANDE.SOUMETTRE:
        // Le client soumet directement vers le conseiller
        if (currentStatus === STATUTS_DEMANDE.BROUILLON) {

          return STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER;
        }
        break;

      case ACTIONS_DEMANDE.ANNULER:
        if (transitions.includes(STATUTS_DEMANDE.ANNULEE)) {

          return STATUTS_DEMANDE.ANNULEE;
        }
        break;

      // ========== NOUVELLE ACTION: PRISE EN CHARGE ==========
      case ACTIONS_DEMANDE.PRENDRE_EN_CHARGE:
        if (currentStatus === STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER && userRole === 'conseiller') {

          return STATUTS_DEMANDE.EN_ETUDE_CONSEILLER;
        }
        break;

      // ========== ACTIONS TRAITEMENT ==========
      case ACTIONS_DEMANDE.VALIDER:
        return this.handleValidation(currentStatus, montant, userRole, notationClient, agence);

      case ACTIONS_DEMANDE.REJETER:
        if (transitions.includes(STATUTS_DEMANDE.REJETEE)) {

          return STATUTS_DEMANDE.REJETEE;
        }
        break;

      case ACTIONS_DEMANDE.REMONTER:
        return this.handleEscalation(currentStatus, userRole);

      case ACTIONS_DEMANDE.RETOURNER:
        return this.handleReturn(currentStatus, userRole);
    }


    return currentStatus;
  }

  /**
   * Gérer la validation avec règles métier - VERSION SIMPLIFIÉE
   */
  static handleValidation(currentStatus, montant, userRole, notationClient, agence) {


    // ========== CAS 1 : EN ÉTUDE CONSEILLER ==========
    if (currentStatus === STATUTS_DEMANDE.EN_ETUDE_CONSEILLER && userRole === 'conseiller') {
      // Le conseiller termine son étude et prend une décision

      // 1. Vérifier si besoin d'analyse risques
      const besoinAnalyseRisques = this.needRiskAnalysis(montant, notationClient);

      if (besoinAnalyseRisques) {

        return STATUTS_DEMANDE.EN_ANALYSE_RISQUES;
      }

      // 2. Vérifier si le conseiller peut valider directement
      const peutValiderDirectement = this.canAuthorize(userRole, montant);

      if (peutValiderDirectement) {

        return STATUTS_DEMANDE.APPROUVEE;
      } else {

        return STATUTS_DEMANDE.EN_ATTENTE_RM;
      }
    }

    // ========== CAS 2 : EN ATTENTE RM/DCE/ADG ==========
    const statusAttentes = {
      'rm': STATUTS_DEMANDE.EN_ATTENTE_RM,
      'dce': STATUTS_DEMANDE.EN_ATTENTE_DCE,
      'adg': STATUTS_DEMANDE.EN_ATTENTE_ADG
    };

    if (statusAttentes[userRole] && currentStatus === statusAttentes[userRole]) {
      const peutAutoriser = this.canAuthorize(userRole, montant);

      if (peutAutoriser) {

        return STATUTS_DEMANDE.APPROUVEE;
      } else {

        return this.getNextLevelStatus(userRole);
      }
    }

    // ========== CAS 3 : EN ANALYSE RISQUES ==========
    if (currentStatus === STATUTS_DEMANDE.EN_ANALYSE_RISQUES) {
      if (userRole === 'risques') {

        return STATUTS_DEMANDE.EN_ATTENTE_RM;
      }

      // RM/DCE/ADG/Admin prend décision après analyse risques
      if (['rm', 'dce', 'adg', 'dga', 'admin'].includes(userRole)) {
        const peutAutoriser = this.canAuthorize(userRole, montant);

        if (peutAutoriser) {

          return STATUTS_DEMANDE.APPROUVEE;
        } else {

          return this.getNextLevelStatus(userRole);
        }
      }
    }


    return currentStatus;
  }

  /**
   * Gérer la remontée hiérarchique
   */
  static handleEscalation(currentStatus, userRole) {


    switch (userRole) {
      case 'conseiller':
        if (currentStatus === STATUTS_DEMANDE.EN_ETUDE_CONSEILLER) {
          return STATUTS_DEMANDE.EN_ATTENTE_RM;
        }
        break;

      case 'rm':
        if (currentStatus === STATUTS_DEMANDE.EN_ATTENTE_RM) {
          return STATUTS_DEMANDE.EN_ATTENTE_DCE;
        }
        break;

      case 'dce':
        if (currentStatus === STATUTS_DEMANDE.EN_ATTENTE_DCE) {
          return STATUTS_DEMANDE.EN_ATTENTE_ADG;
        }
        break;
    }

    return this.getNextLevelStatus(userRole);
  }

  /**
   * Vérifier si un rôle peut autoriser un montant
   */
  static canAuthorize(userRole, montant) {
    const limite = LIMITES_AUTORISATION[userRole];

    if (limite === undefined) {

      return false;
    }

    if (limite === Infinity) {

      return true;
    }

    const peutAutoriser = montant <= limite;


    return peutAutoriser;
  }

  /**
   * Déterminer si besoin d'analyse risques
   */
  static needRiskAnalysis(montant, notationClient) {
    const seuilMontant = WORKFLOW_CONFIG.SEUILS_ANALYSE_RISQUES.MONTANT_MIN;
    const seuilNotation = WORKFLOW_CONFIG.SEUILS_ANALYSE_RISQUES.NOTATION_MAX;

    const notationRisquee = this.compareNotations(notationClient, seuilNotation) > 0;
    const montantEleve = montant >= seuilMontant;

    const besoinAnalyse = notationRisquee || montantEleve;



    return besoinAnalyse;
  }

  /**
   * Comparer deux notations (A < B < C < D < E)
   */
  static compareNotations(notationA, notationB) {
    const ordre = ['A', 'B', 'C', 'D', 'E'];
    const indexA = ordre.indexOf(notationA);
    const indexB = ordre.indexOf(notationB);

    if (indexA === -1 || indexB === -1) return 0;

    return indexA - indexB;
  }

  /**
   * Obtenir le prochain niveau hiérarchique
   */
  static getNextLevelStatus(currentRole) {
    const currentIndex = HIERARCHY.indexOf(currentRole);

    if (currentIndex === -1) {

      return STATUTS_DEMANDE.EN_ATTENTE_ADG;
    }

    for (let i = currentIndex + 1; i < HIERARCHY.length; i++) {
      const nextRole = HIERARCHY[i];

      if (nextRole === 'client') continue;

      switch (nextRole) {
        case 'rm':
          return STATUTS_DEMANDE.EN_ATTENTE_RM;
        case 'dce':
          return STATUTS_DEMANDE.EN_ATTENTE_DCE;
        case 'adg':
        case 'dga':
        case 'admin':
          return STATUTS_DEMANDE.EN_ATTENTE_ADG;
      }
    }

    return STATUTS_DEMANDE.EN_ATTENTE_ADG;
  }

  /**
   * Obtenir les actions disponibles selon le contexte
   */
  static getAvailableActions(currentStatus, userRole, montant, notationClient, isOwner = false) {


    const actions = [];

    // ========== ACTIONS CLIENT ==========
    if (userRole === 'client' && isOwner) {
      if (currentStatus === STATUTS_DEMANDE.BROUILLON) {
        actions.push(ACTIONS_DEMANDE.SOUMETTRE);
        actions.push(ACTIONS_DEMANDE.ANNULER);
      }

      // Peut annuler tant que le conseiller n'a pas pris en charge
      if (currentStatus === STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER) {
        actions.push(ACTIONS_DEMANDE.ANNULER);
      }
    }

    // ========== ACTIONS CONSEILLER ==========
    if (userRole === 'conseiller') {
      // Quand la demande arrive, il doit la prendre en charge
      if (currentStatus === STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER) {
        actions.push(ACTIONS_DEMANDE.PRENDRE_EN_CHARGE);
      }

      // Une fois en étude, il peut décider
      if (currentStatus === STATUTS_DEMANDE.EN_ETUDE_CONSEILLER) {
        actions.push(ACTIONS_DEMANDE.VALIDER);
        actions.push(ACTIONS_DEMANDE.REJETER);
        actions.push(ACTIONS_DEMANDE.REMONTER);
        actions.push(ACTIONS_DEMANDE.RETOURNER);
      }
    }

    // ========== ACTIONS RM/DCE/ADG ==========
    if (['rm', 'dce', 'adg'].includes(userRole)) {
      const statusAttentes = {
        'rm': STATUTS_DEMANDE.EN_ATTENTE_RM,
        'dce': STATUTS_DEMANDE.EN_ATTENTE_DCE,
        'adg': STATUTS_DEMANDE.EN_ATTENTE_ADG
      };

      if (currentStatus === statusAttentes[userRole]) {
        actions.push(ACTIONS_DEMANDE.VALIDER);
        actions.push(ACTIONS_DEMANDE.REJETER);
        actions.push(ACTIONS_DEMANDE.RETOURNER);

        if (userRole !== 'adg') {
          actions.push(ACTIONS_DEMANDE.REMONTER);
        }
      }

      if (currentStatus === STATUTS_DEMANDE.EN_ANALYSE_RISQUES) {
        actions.push(ACTIONS_DEMANDE.VALIDER);
        actions.push(ACTIONS_DEMANDE.REJETER);
      }
    }

    // ========== ACTIONS SERVICE RISQUES ==========
    if (userRole === 'risques' && currentStatus === STATUTS_DEMANDE.EN_ANALYSE_RISQUES) {
      actions.push(ACTIONS_DEMANDE.VALIDER);
      actions.push(ACTIONS_DEMANDE.REJETER);
    }

    // ========== ACTIONS ADMIN/DGA ==========
    if (['admin', 'dga'].includes(userRole)) {
      if (![STATUTS_DEMANDE.REGULARISEE, STATUTS_DEMANDE.ANNULEE].includes(currentStatus)) {
        actions.push(ACTIONS_DEMANDE.VALIDER);
        actions.push(ACTIONS_DEMANDE.REJETER);

        if (currentStatus !== STATUTS_DEMANDE.REJETEE) {
          actions.push(ACTIONS_DEMANDE.ANNULER);
        }
      }

      if (currentStatus === STATUTS_DEMANDE.APPROUVEE) {
        actions.push(ACTIONS_DEMANDE.DECAISSER);
      }
    }


    return actions;
  }

  /**
   * Calculer la priorité selon le contexte
   */
  static calculatePriority(dateEcheance, montant, notationClient, typeOperation) {
    const joursRestants = Math.ceil((new Date(dateEcheance) - new Date()) / (1000 * 60 * 60 * 24));

    if (joursRestants <= 1) {
      return 'URGENTE';
    }

    if (joursRestants <= 3 ||
      montant >= 5000000 ||
      ['D', 'E'].includes(notationClient) ||
      typeOperation === 'URGENCE_TRESORERIE') {
      return 'HAUTE';
    }

    return 'NORMALE';
  }

  /**
   * Gérer le retour pour complément
   */
  static handleReturn(currentStatus, userRole) {


    switch (currentStatus) {
      case STATUTS_DEMANDE.EN_ETUDE_CONSEILLER:
        if (userRole === 'conseiller') {

          return STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER;
        }
        break;

      case STATUTS_DEMANDE.EN_ATTENTE_RM:
        if (userRole === 'rm') {

          return STATUTS_DEMANDE.EN_ETUDE_CONSEILLER;
        }
        break;

      case STATUTS_DEMANDE.EN_ATTENTE_DCE:
        if (userRole === 'dce') {

          return STATUTS_DEMANDE.EN_ATTENTE_RM;
        }
        break;

      case STATUTS_DEMANDE.EN_ATTENTE_ADG:
        if (userRole === 'adg') {

          return STATUTS_DEMANDE.EN_ATTENTE_DCE;
        }
        break;
    }


    return currentStatus;
  }

  /**
   * Calculer le niveau de risque
   */
  static calculateRiskLevel(montant, notationClient) {
    const notationIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(notationClient);

    if (notationIndex >= 3 || montant >= 5000000) {
      return 'CRITIQUE';
    }

    if (notationIndex >= 2 || montant >= 2000000) {
      return 'ELEVE';
    }

    if (notationIndex >= 1 || montant >= 500000) {
      return 'MOYEN';
    }

    return 'FAIBLE';
  }

  /**
   * Vérifier si la transition est autorisée
   */
  static isTransitionAllowed(fromStatus, toStatus) {
    const transitions = TRANSITIONS_AUTORISEES[fromStatus] || [];
    return transitions.includes(toStatus);
  }

  /**
   * Obtenir le rôle responsable d'un statut
   */
  static getResponsibleRole(status) {
    switch (status) {
      case STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER:
      case STATUTS_DEMANDE.EN_ETUDE_CONSEILLER:
        return 'conseiller';

      case STATUTS_DEMANDE.EN_ATTENTE_RM:
        return 'rm';

      case STATUTS_DEMANDE.EN_ATTENTE_DCE:
        return 'dce';

      case STATUTS_DEMANDE.EN_ATTENTE_ADG:
        return 'adg';

      case STATUTS_DEMANDE.EN_ANALYSE_RISQUES:
        return 'risques';

      default:
        return null;
    }
  }
}

module.exports = WorkflowService;