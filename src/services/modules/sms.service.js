/**
 * src/services/modules/sms.service.js
 */
import { apiClient } from '../core/api.client';

export const smsService = {
    async sendSMS(data) {
        return apiClient.request('/sms/send', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    async getSMSLogs() { return apiClient.request('/sms/logs'); },
    async getSMSStats() { return apiClient.request('/sms/stats'); },
    async sendBulkSMS(data) {
        return apiClient.request('/sms/bulk', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    async retryFailedSMS() { return apiClient.request('/sms/retry-failed', { method: 'POST' }); },
    async testSMSProviders() { return apiClient.request('/sms/test-providers', { method: 'POST' }); }
};
