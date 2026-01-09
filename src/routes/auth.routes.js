// src/routes/auth.routes.js - Routes d'authentification publiques
const express = require('express');
const router = express.Router();
const { login, refreshTokenHandler } = require('../controllers/auth/auth.controller');
const { register } = require('../controllers/auth/register.controller');

// Routes publiques (pas d'authentification requise)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshTokenHandler);

module.exports = router;
