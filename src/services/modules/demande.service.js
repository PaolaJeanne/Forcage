/**
 * src/services/modules/demande.service.js
 */
import { apiClient } from '../core/api.client';

export const demandeService = {
    async getDemandes(filters = {}) {
        return apiClient.request(`/demandes${apiClient.getQueryString(filters)}`);
    },

    async getTeamDemandes(filters = {}) {
        return apiClient.request(`/demandes/team/demandes${apiClient.getQueryString(filters)}`);
    },

    async getAgencyDemandes(filters = {}) {
        return apiClient.request(`/demandes/agency/demandes${apiClient.getQueryString(filters)}`);
    },

    async getAllDemandes(filters = {}) {
        return apiClient.request(`/demandes/all/demandes${apiClient.getQueryString(filters)}`);
    },

    async getDemande(id) {
        return apiClient.request(`/demandes/${id}`);
    },

    async createDemande(formData) {
        // formData must be FormData instance
        return apiClient.request('/demandes', {
            method: 'POST',
            body: formData
        });
    },

    async updateDemande(id, data) {
        return apiClient.request(`/demandes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async soumettreDemande(id) {
        return apiClient.request(`/demandes/${id}/soumettre`, { method: 'PATCH' });
    },

    async annulerDemande(id) {
        return apiClient.request(`/demandes/${id}/annuler`, { method: 'PATCH' });
    },

    async prendreEnCharge(id) {
        return apiClient.request(`/demandes/${id}/prendre-en-charge`, { method: 'PATCH' });
    },

    async getDemandeStatus(id) {
        return apiClient.request(`/demandes/${id}/status`);
    },

    async getDemandeActions(id) {
        return apiClient.request(`/demandes/${id}/actions`);
    },

    async getDemandeStatistics() {
        return apiClient.request('/demandes/statistics');
    },

    async regulariserDemande(id) {
        return apiClient.request(`/demandes/${id}/regulariser`, { method: 'PATCH' });
    }
};
