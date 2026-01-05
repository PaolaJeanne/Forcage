
// src/routes/report.routes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

/**
 * @route   GET /api/v1/reports
 * @desc    Lister les rapports de l'utilisateur
 */
router.get('/', reportController.getReports);

/**
 * @route   POST /api/v1/reports
 * @desc    Créer un nouveau rapport
 */
router.post('/', reportController.createReport);

/**
 * @route   GET /api/v1/reports/:id
 * @desc    Récupérer un rapport spécifique
 */
router.get('/:id', reportController.getReportById);

/**
 * @route   DELETE /api/v1/reports/:id
 * @desc    Supprimer un rapport
 */
router.delete('/:id', reportController.deleteReport);

module.exports = router;
