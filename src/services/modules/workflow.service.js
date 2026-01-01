/**
 * src/services/modules/workflow.service.js
 */
import { apiClient } from '../core/api.client';

export const workflowService = {
    async validerDemande(id, commentaire) {
        return apiClient.request(`/workflow/${id}/valider`, {
            method: 'PATCH',
            body: JSON.stringify({ commentaire })
        });
    },

    async rejeterDemande(id, motif) {
        return apiClient.request(`/workflow/${id}/rejeter`, {
            method: 'PATCH',
            body: JSON.stringify({ motif })
        });
    },

    async remonterDemande(id, commentaire) {
        return apiClient.request(`/workflow/${id}/remonter`, {
            method: 'PATCH',
            body: JSON.stringify({ commentaire })
        });
    },

    async assignerDemande(id, userId) {
        return apiClient.request(`/workflow/${id}/assigner`, {
            method: 'PATCH',
            body: JSON.stringify({ userId })
        });
    },

    async getWorkflowTrack(id) {
        return apiClient.request(`/workflow/${id}/workflow-track`);
    },

    async getDemandesEnRetard() {
        return apiClient.request('/workflow/demandes-en-retard');
    },

    async getStatsWorkflow() {
        return apiClient.request('/workflow/stats-workflow');
    }
};
