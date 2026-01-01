/**
 * src/services/modules/document.service.js
 */
import { apiClient } from '../core/api.client';

export const documentService = {
    async uploadPiecesJustificatives(demandeId, files) {
        const formData = new FormData();
        if (Array.isArray(files)) {
            files.forEach(file => formData.append('piecesJustificatives', file));
        } else {
            formData.append('piecesJustificatives', files);
        }

        return apiClient.request(`/documents/demandes/${demandeId}/pieces-justificatives`, {
            method: 'POST',
            body: formData
        });
    },
    async listerPiecesJustificatives(demandeId) { return apiClient.request(`/documents/demandes/${demandeId}/pieces-justificatives`); },
    async telechargerPieceJustificative(demandeId, index) {
        return apiClient.request(`/documents/demandes/${demandeId}/pieces-justificatives/${index}`);
    },
    async supprimerPieceJustificative(demandeId, index) {
        return apiClient.request(`/documents/demandes/${demandeId}/pieces-justificatives/${index}`, { method: 'DELETE' });
    },

    // Generic Upload
    async uploadFile(file, onProgress) {
        const token = apiClient.getToken();
        const formData = new FormData();
        formData.append('file', file);

        // This duplicates logic inside ApiClient somewhat, but handles XHR progress specifically.
        // For consistency we keep it here but could refactor it into ApiClient later if needed.
        // Since ApiClient mainly uses fetch, we keep XHR logic here or move to ApiClient using fetch+streams?
        // For now, keep as is but inside this service.

        // To access API_BASE_URL we might need to expose it or reconstruct it.
        // Assuming we reconstruct or import it (but it's private in ApiClient file).
        // Let's rely on relative imports or assumption for now, OR rely on a simpler fetch upload if progress isn't critical
        // OR implement XHR here.

        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded * 100) / e.total);
                        onProgress(percentComplete);
                    }
                });
            }

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.response));
                    } catch (e) {
                        resolve(xhr.response);
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Upload failed')));

            xhr.open('POST', `${API_BASE_URL}/upload`);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });
    }
};
