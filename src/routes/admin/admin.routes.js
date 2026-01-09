// src/routes/admin.routes.js - Routes administration (Point d'entrée)
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');

// Middleware pour vérifier l'authentification
router.use(authenticate);

// ==========================================
// ROUTES UTILISATEURS ET AGENCES
// ==========================================
const adminUsersRoutes = require('./admin.users.routes');
router.use('/', adminUsersRoutes);

// ==========================================
// AUTRES ROUTES ADMIN (À ajouter selon les besoins)
// ==========================================
// router.use('/reports', require('./admin/admin.reports.routes'));
// router.use('/settings', require('./admin/admin.settings.routes'));

module.exports = router;
