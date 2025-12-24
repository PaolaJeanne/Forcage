// ============================================
// src/controllers/dashboard.controller.js
// ============================================
const DashboardService = require('../services/dashboard.service');

// Helper pour les réponses
const successResponse = (res, status, message, data) => {
  return res.status(status).json({
    success: true,
    message,
    data
  });
};

const errorResponse = (res, status, message, error = null) => {
  return res.status(status).json({
    success: false,
    message,
    error
  });
};

module.exports = {
  /**
   * GET /api/v1/dashboard
   * Dashboard principal selon le rôle
   */
  getDashboard: async (req, res) => {
    try {
      const filters = {
        statut: req.query.statut,
        typeOperation: req.query.typeOperation,
        scoreRisque: req.query.scoreRisque,
        dateDebut: req.query.dateDebut,
        dateFin: req.query.dateFin,
        agenceId: req.query.agenceId,
        conseillerId: req.query.conseillerId,
        clientId: req.query.clientId
      };

      const dashboardData = await DashboardService.getDashboardData(req.user, filters);

      return successResponse(res, 200, 'Dashboard récupéré avec succès', dashboardData);

    } catch (error) {
      console.error('❌ Erreur dashboard:', error);
      return errorResponse(res, 500, 'Erreur lors de la récupération du dashboard', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/own
   * Dashboard personnel (mes propres données)
   */
  getOwnDashboard: async (req, res) => {
    try {
      const filters = { ...req.query };
      const dashboardData = await DashboardService.getDashboardData(req.user, filters);

      // Filtrer pour ne garder que les données personnelles
      const ownData = {
        user: dashboardData.user,
        kpis: dashboardData.kpis,
        recentActivities: dashboardData.recentActivities,
        stats: {
          demandesParStatut: dashboardData.stats.demandesParStatut
        }
      };

      return successResponse(res, 200, 'Dashboard personnel récupéré', ownData);

    } catch (error) {
      console.error('❌ Erreur dashboard personnel:', error);
      return errorResponse(res, 500, 'Erreur dashboard personnel', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/team
   * Dashboard de l'équipe
   */
  getTeamDashboard: async (req, res) => {
    try {
      const filters = { ...req.query };
      const dashboardData = await DashboardService.getDashboardData(req.user, filters);

      return successResponse(res, 200, 'Dashboard équipe récupéré', {
        user: dashboardData.user,
        kpis: dashboardData.kpis,
        stats: dashboardData.stats,
        recentActivities: dashboardData.recentActivities
      });

    } catch (error) {
      console.error('❌ Erreur dashboard équipe:', error);
      return errorResponse(res, 500, 'Erreur dashboard équipe', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/agency
   * Dashboard de l'agence
   */
  getAgencyDashboard: async (req, res) => {
    try {
      const filters = { ...req.query };
      const dashboardData = await DashboardService.getDashboardData(req.user, filters);

      return successResponse(res, 200, 'Dashboard agence récupéré', dashboardData);

    } catch (error) {
      console.error('❌ Erreur dashboard agence:', error);
      return errorResponse(res, 500, 'Erreur dashboard agence', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/global
   * Dashboard global (toutes les agences)
   */
  getGlobalDashboard: async (req, res) => {
    try {
      const filters = { ...req.query };
      const dashboardData = await DashboardService.getDashboardData(req.user, filters);

      // Ajouter des stats globales supplémentaires
      const globalStats = await DashboardService.getGlobalStats();

      return successResponse(res, 200, 'Dashboard global récupéré', {
        ...dashboardData,
        globalStats
      });

    } catch (error) {
      console.error('❌ Erreur dashboard global:', error);
      return errorResponse(res, 500, 'Erreur dashboard global', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/kpis
   * KPIs selon le rôle
   */
  getKPIs: async (req, res) => {
    try {
      const query = DashboardService.buildQueryForRole(req.user, req.query);
      const kpis = await DashboardService.getFilteredKPIs(query, req.user.role);

      return successResponse(res, 200, 'KPIs récupérés', {
        kpis,
        role: req.user.role,
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('❌ Erreur KPIs:', error);
      return errorResponse(res, 500, 'Erreur récupération KPIs', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/stats
   * Statistiques complètes
   */
  getStats: async (req, res) => {
    try {
      const stats = await DashboardService.getFilteredStats(req.user, req.query);

      return successResponse(res, 200, 'Statistiques récupérées', { stats });

    } catch (error) {
      console.error('❌ Erreur stats:', error);
      return errorResponse(res, 500, 'Erreur récupération stats', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/activities
   * Activités récentes
   */
  getRecentActivities: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const query = DashboardService.buildQueryForRole(req.user, req.query);
      const activities = await DashboardService.getRecentActivities(query, req.user.role, limit);

      return successResponse(res, 200, 'Activités récentes récupérées', {
        activities,
        total: activities.length
      });

    } catch (error) {
      console.error('❌ Erreur activités:', error);
      return errorResponse(res, 500, 'Erreur récupération activités', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/alertes
   * Alertes
   */
  getAlertes: async (req, res) => {
    try {
      const query = DashboardService.buildQueryForRole(req.user, req.query);
      const alertes = await DashboardService.getAlertes(query, req.user.role);

      return successResponse(res, 200, 'Alertes récupérées', {
        alertes,
        total: alertes.length
      });

    } catch (error) {
      console.error('❌ Erreur alertes:', error);
      return errorResponse(res, 500, 'Erreur récupération alertes', error.message);
    }
  }
};
