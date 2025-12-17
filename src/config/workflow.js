// src/config/workflow.js
module.exports = {
  DEMANDE_STATES: {
    BROUILLON: 'BROUILLON',
    ENVOYEE: 'ENVOYEE',
    EN_ETUDE: 'EN_ETUDE',
    EN_VALIDATION: 'EN_VALIDATION',
    VALIDEE: 'VALIDEE',
    REFUSEE: 'REFUSEE',
    ANNULEE: 'ANNULEE'
  },
  
  ALLOWED_TRANSITIONS: {
    BROUILLON: ['ENVOYEE', 'ANNULEE'],
    ENVOYEE: ['EN_ETUDE', 'ANNULEE'],
    EN_ETUDE: ['EN_VALIDATION', 'REFUSEE'],
    // ... toutes les transitions
  }
};