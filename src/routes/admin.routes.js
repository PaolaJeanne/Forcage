// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const schedulerRoutes = require('./scheduler.routes');

// Toutes les routes admin nécessitent l'authentification admin
router.use(authenticate);
router.use(requireAdmin);

// Gestion des utilisateurs
router.post('/users', adminController.createUser);
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserById);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/toggle-status', adminController.toggleUserStatus);
router.delete('/users/:userId', adminController.deleteUser);

// Routes du scheduler
router.use('/scheduler', schedulerRoutes);

module.exports = router;