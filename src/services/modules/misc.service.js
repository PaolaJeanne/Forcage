/**
 * src/services/modules/misc.service.js
 * Contains Export and Health Check services
 */
import { apiClient } from '../core/api.client';

export const exportService = {
    async exportDemandePDF(id) { return apiClient.request(`/export/demande/${id}/pdf`); },
    async exportStatistiquesPDF() { return apiClient.request('/export/statistiques/pdf'); }
};

export const healthService = {
    async checkHealth() {
        // Implementation that bypasses the standard API wrapper to check the root /health
        // Assuming we need to reconstruct the URL as in original code
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
        try {
            const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`);
            return await response.json();
        } catch (error) {
            console.error('❌ Health check failed:', error);
            return { status: 'error', message: error.message };
        }
    }
};
