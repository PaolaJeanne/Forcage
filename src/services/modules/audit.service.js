/**
 * src/services/modules/audit.service.js
 */
import { apiClient } from '../core/api.client';

export const auditService = {
    async getAuditLogs() { return apiClient.request('/audit/logs'); },
    async getEntityHistory(entite, entiteId) { return apiClient.request(`/audit/entity/${entite}/${entiteId}`); },
    async getUserHistory(userId) { return apiClient.request(`/audit/user/${userId}`); },
    async getAuditStatistics() { return apiClient.request('/audit/statistics'); },
    async exportAuditLogs() { return apiClient.request('/audit/export'); },
    async cleanAuditLogs() { return apiClient.request('/audit/clean', { method: 'DELETE' }); }
};
