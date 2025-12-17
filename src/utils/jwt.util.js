// utils/jwt.util.js - Version améliorée
const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Génère un token avec toutes les infos utilisateur nécessaires
const generateToken = (userData) => {
  return jwt.sign(
    {
      userId: userData.userId || userData._id,
      email: userData.email,
      role: userData.role,
      nom: userData.nom,
      prenom: userData.prenom,
      limiteAutorisation: userData.limiteAutorisation,
      agence: userData.agence,
      isActive: userData.isActive
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn
    }
  );
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw new Error('Refresh token invalide ou expiré');
  }
};

// OPTIMISATION: Fonction pour extraire l'utilisateur du token
const getUserFromToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return {
      id: decoded.userId,           // ⭐ CRITIQUE: doit être l'ID MongoDB
      _id: decoded.userId,          // Pour compatibilité
      email: decoded.email,
      role: decoded.role,
      nom: decoded.nom,
      prenom: decoded.prenom,
      limiteAutorisation: decoded.limiteAutorisation,
      agence: decoded.agence,
      isActive: decoded.isActive
    };
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  getUserFromToken
};