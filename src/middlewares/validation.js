// Créez un middleware de validation centralisé
// src/middleware/validation.js
const { body, param, validationResult } = require('express-validator');

const validateDemandeCreation = [
  body('motif').isLength({ min: 10, max: 500 }),
  body('montant').isFloat({ min: 0 }),
  body('typeOperation').isIn(['VIREMENT', 'PRELEVEMENT', 'CHEQUE', 'CARTE', 'RETRAIT', 'AUTRE']),
  body('compteNumero').matches(/^[A-Z0-9]{8,12}$/),
  // Ajoutez toutes les validations nécessaires
];