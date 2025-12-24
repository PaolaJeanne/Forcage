// src/middlewares/role.middleware.js
const { errorResponse } = require('../utils/response.util');

exports.authorize = (roles = []) => (req, res, next) => {
  if (!roles.includes(req.userRole)) {
    return errorResponse(res, 403, 'Accès non autorisé');
  }
  next();
};

// Ajouter checkRole comme alias de authorize
exports.checkRole = exports.authorize;