/**
 * src/services/modules/auth.service.js
 */
import { apiClient } from '../core/api.client';

export const authService = {
    async login(email, password) {
        const data = await apiClient.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (data.success && data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user || data.data?.user));
        }
        return data;
    },

    async register(userData) {
        return apiClient.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async refreshToken() {
        return apiClient.request('/auth/refresh-token', { method: 'POST' });
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    async getProfile() {
        return apiClient.request('/auth/profile');
    },

    async updateProfile(userData) {
        return apiClient.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },

    async changePassword(passwords) {
        return apiClient.request('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify(passwords)
        });
    }
};
