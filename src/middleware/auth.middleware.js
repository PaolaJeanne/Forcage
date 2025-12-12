// middleware/auth.middleware.js
const { verifyToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token manquant ou invalide'); // Ajoute ce log pour vérifier
      return errorResponse(res, 401, "Token d'authentification manquant");
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      console.log('Utilisateur non trouvé ou inactif'); // Ajoute ce log aussi
      return errorResponse(res, 401, 'Utilisateur non trouvé ou inactif');
    }
    
    req.user = user;
    req.userId = user._id;
    
    return next();
  } catch (error) {
    console.log('Erreur de token', error); // Et encore un log ici
    return errorResponse(res, 401, 'Token invalide ou expiré');
  }
};

// middleware/auth.middleware.js
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Non authentifié');
    }
    
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 403, 'Accès refusé: permissions insuffisantes');
    }
    
    return next(); // Si l'utilisateur est authentifié et autorisé, on passe au middleware suivant
  };
};


module.exports = {
  authenticate,
  authorize
};