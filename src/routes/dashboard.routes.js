

// ============================================
// src/routes/dashboard.routes.js
// ============================================
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent authentification
router.use(authenticate);

// Dashboard principal
router.get('/', dashboardController.getDashboard);

// Dashboards spécifiques
router.get('/own', dashboardController.getOwnDashboard);
router.get('/team', dashboardController.getTeamDashboard);
router.get('/agency', dashboardController.getAgencyDashboard);
router.get('/global', dashboardController.getGlobalDashboard);

// KPIs
router.get('/kpis', dashboardController.getKPIs);

// Statistiques
router.get('/stats', dashboardController.getStats);

// Activités récentes
router.get('/activities', dashboardController.getRecentActivities);

// Alertes
router.get('/alertes', dashboardController.getAlertes);

module.exports = router;