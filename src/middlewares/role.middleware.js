const { errorResponse } = require('../utils/response.util');

exports.authorize = (roles = []) => (req, res, next) => {
  if (!roles.includes(req.userRole)) {
    return errorResponse(res, 403, 'Accès non autorisé');
  }
  next();
};
