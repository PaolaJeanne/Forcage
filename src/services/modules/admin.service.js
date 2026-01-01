/**
 * src/services/modules/admin.service.js
 */
import { apiClient } from '../core/api.client';

export const adminService = {
    // Users
    async getAllUsers() { return apiClient.request('/admin/users'); },
    async getUserById(id) { return apiClient.request(`/admin/users/${id}`); },
    async createUser(userData) {
        return apiClient.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    async updateUserRole(userId, role) {
        return apiClient.request(`/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
    },
    async toggleUserStatus(userId) {
        return apiClient.request(`/admin/users/${userId}/toggle-status`, { method: 'PUT' });
    },
    async deleteUser(userId) {
        return apiClient.request(`/admin/users/${userId}`, { method: 'DELETE' });
    },

    // Scheduler
    async getSchedulerStatus() { return apiClient.request('/admin/scheduler/status'); },
    async getSchedulerJobs() { return apiClient.request('/admin/scheduler/jobs'); },
    async runSchedulerJob(job) {
        return apiClient.request('/admin/scheduler/run', {
            method: 'POST',
            body: JSON.stringify({ job })
        });
    },
    async startScheduler() { return apiClient.request('/admin/scheduler/start', { method: 'POST' }); },
    async stopScheduler() { return apiClient.request('/admin/scheduler/stop', { method: 'POST' }); }
};
