// src/routes/user.routes.js - Routes utilisateur (authentifiées)
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/user/profile.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Toutes ces routes nécessitent une authentification
router.use(authenticate);

// Routes de profil utilisateur
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

module.exports = router;
