// routes/admin/users.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const { validateUserId } = require('../../middlewares/validation.middleware');

// Récupérer tous les utilisateurs
router.get('/', adminController.getAllUsers);

// Récupérer tous les clients
router.get('/clients', adminController.getAllClients);

// Récupérer un utilisateur spécifique
router.get('/:userId', validateUserId, adminController.getUserById);

// Créer un nouvel utilisateur
router.post('/', adminController.createUser);

// Mettre à jour le rôle d'un utilisateur
router.put('/:userId/role', validateUserId, adminController.updateUserRole);

// Activer/désactiver un utilisateur
router.put('/:userId/toggle-status', validateUserId, adminController.toggleUserStatus);

// Assigner un utilisateur à une agence
router.put('/:userId/assign-agency', validateUserId, adminController.assignUserToAgency);

// Supprimer (désactiver) un utilisateur
router.delete('/:userId', validateUserId, adminController.deleteUser);

// Routes pour les utilisateurs par agence
router.get('/agency/:agencyName', adminController.getUsersByAgency);

module.exports = router;
