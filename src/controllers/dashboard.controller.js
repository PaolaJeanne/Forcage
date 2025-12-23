// src/controllers/dashboard.controller.js
const DashboardService = require('../services/dashboard.service');
const PermissionHelper = require('../helpers/permission.helper');
const { successResponse, errorResponse } = require('../utils/response.util');

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
        dateFin: req.query.dateFin
      };

      const dashboardData = await DashboardService.getDashboardData(req.user, filters);

      return successResponse(res, 200, 'Dashboard récupéré avec succès', dashboardData);

    } catch (error) {

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
          demandesParStatut: dashboardData.stats.demandesParStatut,
          demandesParType: dashboardData.stats.demandesParType
        }
      };

      return successResponse(res, 200, 'Dashboard personnel récupéré', ownData);

    } catch (error) {

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

      return errorResponse(res, 500, 'Erreur dashboard global', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/widgets
   * Widgets disponibles selon le rôle
   */
  getWidgets: async (req, res) => {
    try {
      const widgets = PermissionHelper.getAvailableWidgets(req.user.role);

      return successResponse(res, 200, 'Widgets récupérés', {
        widgets,
        total: widgets.length,
        role: req.user.role
      });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération widgets', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/permissions
   * Permissions de l'utilisateur
   */
  getPermissions: async (req, res) => {
    try {
      const permissions = PermissionHelper.getRolePermissions(req.user.role);

      return successResponse(res, 200, 'Permissions récupérées', {
        user: {
          id: req.user.id,
          role: req.user.role,
          nom: req.user.nom,
          prenom: req.user.prenom
        },
        permissions,
        total: permissions.length
      });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération permissions', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/kpis
   * KPIs selon le rôle
   */
  getKPIs: async (req, res) => {
    try {
      const query = PermissionHelper.buildQueryForRole(req.user, req.query);
      const kpis = await DashboardService.getKPIs(query, req.user.role);

      return successResponse(res, 200, 'KPIs récupérés', {
        kpis,
        role: req.user.role,
        generatedAt: new Date()
      });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération KPIs', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/stats/basic
   * Statistiques de base
   */
  getBasicStats: async (req, res) => {
    try {
      const query = PermissionHelper.buildQueryForRole(req.user, req.query);
      const stats = await DashboardService.getBasicStats(query, req.user.role);

      return successResponse(res, 200, 'Statistiques de base récupérées', { stats });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération stats', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/stats/advanced
   * Statistiques avancées
   */
  getAdvancedStats: async (req, res) => {
    try {
      const query = PermissionHelper.buildQueryForRole(req.user, req.query);
      const stats = await DashboardService.getAdvancedStats(query, req.user.role);

      return successResponse(res, 200, 'Statistiques avancées récupérées', { stats });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération stats avancées', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/stats/risk
   * Statistiques de risque
   */
  getRiskStats: async (req, res) => {
    try {
      const query = PermissionHelper.buildQueryForRole(req.user, req.query);
      const stats = await DashboardService.getRiskStats(query, req.user.role);

      return successResponse(res, 200, 'Statistiques de risque récupérées', { stats });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération stats risque', error.message);
    }
  },

  /**
   * GET /api/v1/dashboard/activities/recent
   * Activités récentes
   */
  getRecentActivities: async (req, res) => {
    try {
      const query = PermissionHelper.buildQueryForRole(req.user, req.query);
      const limit = parseInt(req.query.limit) || 10;

      const activities = await DashboardService.getRecentActivities(query, req.user.role, limit);

      return successResponse(res, 200, 'Activités récentes récupérées', {
        activities,
        total: activities.length
      });

    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération activités', error.message);
    }
  }
};