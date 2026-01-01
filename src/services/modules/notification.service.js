/**
 * src/services/modules/notification.service.js
 */
import { apiClient } from '../core/api.client';

export const notificationService = {
    async getNotifications(filters = {}) {
        return apiClient.request(`/notifications${apiClient.getQueryString(filters)}`);
    },

    async getUnreadCount() {
        return apiClient.request('/notifications/unread/count');
    },

    async getNotificationStats() {
        return apiClient.request('/notifications/stats');
    },

    async markAsRead(notificationId) {
        return apiClient.request(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    },

    async markAllAsRead(filters = {}) {
        return apiClient.request(`/notifications/read-all${apiClient.getQueryString(filters)}`, { method: 'PATCH' });
    },

    async deleteNotification(notificationId) {
        return apiClient.request(`/notifications/${notificationId}`, { method: 'DELETE' });
    },

    async createAdminNotification(data) {
        return apiClient.request('/notifications/admin/create', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};
