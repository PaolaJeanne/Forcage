// src/routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');
const { auditLogger } = require('../middlewares/audit.middleware');
const dashboardCache = require('../middlewares/cache.middleware');

// Dashboard principal (tous les utilisateurs authentifiés)
router.get(
  '/',
  authenticate,
  requirePermission('VIEW_DASHBOARD'),
  dashboardCache(300), // Cache de 5 minutes
  auditLogger('consultation', 'dashboard'),
  dashboardController.getDashboard
);

// Dashboard personnel (client, conseiller)
router.get(
  '/own',
  authenticate,
  requirePermission('VIEW_OWN_DASHBOARD'),
  dashboardCache(180), // Cache de 3 minutes
  auditLogger('consultation', 'dashboard_own'),
  dashboardController.getOwnDashboard
);

// Dashboard de l'équipe (conseillers et +)
router.get(
  '/team',
  authenticate,
  requirePermission('VIEW_TEAM_DASHBOARD'),
  dashboardCache(300),
  auditLogger('consultation', 'dashboard_team'),
  dashboardController.getTeamDashboard
);

// Dashboard de l'agence (RM, DCE, ADG et +)
router.get(
  '/agency',
  authenticate,
  requirePermission('VIEW_AGENCY_DASHBOARD'),
  dashboardCache(300),
  auditLogger('consultation', 'dashboard_agency'),
  dashboardController.getAgencyDashboard
);

// Dashboard global (DGA, Admin, Risques)
router.get(
  '/global',
  authenticate,
  requirePermission('VIEW_GLOBAL_DASHBOARD'),
  dashboardCache(300),
  auditLogger('consultation', 'dashboard_global'),
  dashboardController.getGlobalDashboard
);

// Widgets disponibles selon le rôle
router.get(
  '/widgets',
  authenticate,
  requirePermission('VIEW_DASHBOARD'),
  dashboardController.getWidgets
);

// Permissions de l'utilisateur
router.get(
  '/permissions',
  authenticate,
  dashboardController.getPermissions
);

// KPIs
router.get(
  '/kpis',
  authenticate,
  requirePermission('VIEW_DASHBOARD'),
  dashboardCache(180),
  dashboardController.getKPIs
);

// Statistiques de base
router.get(
  '/stats/basic',
  authenticate,
  requirePermission('VIEW_BASIC_STATS'),
  dashboardCache(300),
  dashboardController.getBasicStats
);

// Statistiques avancées
router.get(
  '/stats/advanced',
  authenticate,
  requirePermission('VIEW_ADVANCED_STATS'),
  dashboardCache(300),
  auditLogger('consultation', 'stats_advanced'),
  dashboardController.getAdvancedStats
);

// Statistiques de risque
router.get(
  '/stats/risk',
  authenticate,
  requirePermission('VIEW_RISK_STATS'),
  dashboardCache(300),
  auditLogger('consultation', 'stats_risk'),
  dashboardController.getRiskStats
);

// Activités récentes
router.get(
  '/activities/recent',
  authenticate,
  requirePermission('VIEW_DASHBOARD'),
  dashboardCache(60), // Cache de 1 minute
  dashboardController.getRecentActivities
);

module.exports = router;