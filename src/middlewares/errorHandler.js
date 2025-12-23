// src/middlewares/errorHandler.js
const { errorResponse } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {


  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return errorResponse(res, 400, 'Erreur de validation', errors);
  }

  // Erreur de duplication MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return errorResponse(res, 409, `${field} existe déjà`);
  }

  // Erreur de cast MongoDB (ID invalide)
  if (err.name === 'CastError') {
    return errorResponse(res, 400, 'ID invalide');
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 401, 'Token invalide');
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 401, 'Token expiré');
  }

  // Erreur par défaut
  return errorResponse(
    res,
    err.statusCode || 500,
    err.message || 'Erreur serveur interne'
  );
};

// Middleware pour les routes non trouvées
const notFound = (req, res) => {
  errorResponse(res, 404, `Route ${req.originalUrl} introuvable`);
};

module.exports = { errorHandler, notFound };