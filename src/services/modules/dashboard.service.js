/**
 * src/services/modules/dashboard.service.js
 */
import { apiClient } from '../core/api.client';

export const dashboardService = {
    async getDashboard() { return apiClient.request('/dashboard'); },
    async getOwnDashboard() { return apiClient.request('/dashboard/own'); },
    async getTeamDashboard() { return apiClient.request('/dashboard/team'); },
    async getAgencyDashboard() { return apiClient.request('/dashboard/agency'); },
    async getGlobalDashboard() { return apiClient.request('/dashboard/global'); },
    async getKPIs() { return apiClient.request('/dashboard/kpis'); },
    async getStats() { return apiClient.request('/dashboard/stats'); },
    async getRecentActivities() { return apiClient.request('/dashboard/activities'); },
    async getAlertes() { return apiClient.request('/dashboard/alertes'); }
};
