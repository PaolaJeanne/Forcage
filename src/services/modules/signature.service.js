/**
 * src/services/modules/signature.service.js
 */
import { apiClient } from '../core/api.client';

export const signatureService = {
    async signerDemande(demandeId, signatureData) {
        return apiClient.request(`/signatures/demande/${demandeId}/sign`, {
            method: 'POST',
            body: JSON.stringify(signatureData)
        });
    },
    async verifierSignature(signatureId) { return apiClient.request(`/signatures/${signatureId}/verify`); },
    async genererSignatureQRCode(signatureId) { return apiClient.request(`/signatures/${signatureId}/qrcode`); },
    async getDemandeSignatures(demandeId) { return apiClient.request(`/signatures/demande/${demandeId}`); },
    async invaliderSignature(signatureId) { return apiClient.request(`/signatures/${signatureId}`, { method: 'DELETE' }); }
};
