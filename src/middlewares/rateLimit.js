const rateLimit = require('express-rate-limit');

const clientLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 requêtes/15min pour les clients
  message: 'Trop de requêtes pour un client'
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Plus pour les admins
});