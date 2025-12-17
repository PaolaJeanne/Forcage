// src/utils/validation.util.js
const Joi = require('joi');

// Schémas de validation communs
const validations = {
  // Authentification
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  // Utilisateur
  user: Joi.object({
    nom: Joi.string().min(2).max(50).required(),
    prenom: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    role: Joi.string().valid('client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'),
    agence: Joi.string().when('role', {
      is: Joi.string().valid('conseiller', 'rm', 'dce'),
      then: Joi.string().required(),
      otherwise: Joi.string().optional()
    }),
    limiteAutorisation: Joi.number().min(0)
  }),

  // Demande de forçage
  demande: Joi.object({
    clientId: Joi.string().required(),
    montant: Joi.number().min(1000).required(),
    description: Joi.string().max(500),
    documents: Joi.array().items(Joi.string()),
    priorite: Joi.string().valid('basse', 'moyenne', 'haute', 'critique')
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    sort: Joi.string(),
    order: Joi.string().valid('asc', 'desc')
  })
};

// Middleware de validation
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }
    
    next();
  };
};

module.exports = {
  validations,
  validate
};