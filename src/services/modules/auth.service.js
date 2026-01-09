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

        if (data.success && data.data) {
            const { token, refreshToken, user } = data.data;
            if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('refreshToken', refreshToken || '');
                localStorage.setItem('user', JSON.stringify(user));
                console.log('✅ Token stored in localStorage:', token.substring(0, 20) + '...');
            }
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
