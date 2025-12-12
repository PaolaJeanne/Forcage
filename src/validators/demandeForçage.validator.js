// ============================================
// 2. VALIDATORS - validators/demandeForçage.validator.js
// ============================================
const { body, param, query } = require('express-validator');

exports.createDemandeValidator = [
  body('compteNumero').notEmpty().withMessage('Numéro de compte requis'),
  body('typeOperation').isIn(['VIREMENT', 'PRELEVEMENT', 'CHEQUE', 'CARTE', 'RETRAIT', 'AUTRE'])
    .withMessage('Type d\'opération invalide'),
  body('montant').isFloat({ min: 1 }).withMessage('Montant invalide'),
  body('motif').isLength({ min: 10, max: 500 }).withMessage('Motif requis (10-500 caractères)')
];

exports.updateStatutValidator = [
  param('id').isMongoId().withMessage('ID invalide'),
  body('statut').isIn(['EN_ETUDE', 'EN_VALIDATION', 'VALIDEE', 'REFUSEE', 'ANNULEE'])
    .withMessage('Statut invalide'),
  body('commentaire').optional().isLength({ max: 500 })
];

exports.listDemandesValidator = [
  query('statut').optional().isIn(['BROUILLON', 'ENVOYEE', 'EN_ETUDE', 'EN_VALIDATION', 'VALIDEE', 'REFUSEE', 'ANNULEE']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];