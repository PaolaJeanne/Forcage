// routes/admin/agencies.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin.controller');
const { validateAgencyId } = require('../../middlewares/validation.middleware');

// Récupérer toutes les agences
router.get('/', adminController.getAgences);

// Récupérer les statistiques des agences
router.get('/statistics', adminController.getAgencyStats);

// Créer une nouvelle agence
router.post('/', adminController.createAgency);

// Récupérer une agence spécifique
router.get('/:agencyId', validateAgencyId, adminController.getAgencyById);

// Mettre à jour une agence
router.put('/:agencyId', validateAgencyId, adminController.updateAgency);

// Désactiver une agence
router.delete('/:agencyId', validateAgencyId, adminController.deactivateAgency);

// Récupérer les utilisateurs d'une agence
router.get('/:agencyId/users', validateAgencyId, adminController.getAgencyUsers);

module.exports = router;
