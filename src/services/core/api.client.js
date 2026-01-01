/**
 * src/services/core/api.client.js
 * Core HTTP Client to handle fetch requests, headers, and errors.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

class ApiClient {
    getToken() {
        return localStorage.getItem('token');
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            ...options.headers
        };

        // Do not set Content-Type if body is FormData (browser handles it)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            // Handle empty or non-JSON content (e.g. PDF exports)
            const contentType = response.headers.get('content-type');
            if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/vnd.openxmlformats-officedocument'))) {
                return await response.blob();
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                if (response.status === 204) return { success: true };
                console.error('❌ JSON Parse Error:', parseError);
                throw new Error('Invalid server response');
            }

            if (!response.ok) {
                const errorMessage = data.message || data.error || `Error ${response.status}`;
                const error = new Error(errorMessage);
                error.status = response.status;
                error.data = data;

                console.error('❌ HTTP Error:', {
                    status: response.status,
                    message: errorMessage,
                    data: data
                });

                throw error;
            }

            return data;
        } catch (error) {
            console.error('❌ API Error:', error);

            if (error.message === 'Failed to fetch') {
                const networkError = new Error('Cannot contact server. Check if backend is running.');
                networkError.isNetworkError = true;
                throw networkError;
            }

            throw error;
        }
    }

    cleanFilters(filters = {}) {
        const cleaned = {};
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '' && value !== 'null') {
                cleaned[key] = value;
            }
        });
        return cleaned;
    }

    getQueryString(filters = {}) {
        const cleaned = this.cleanFilters(filters);
        const params = new URLSearchParams(cleaned);
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    }
}

export const apiClient = new ApiClient();
export default ApiClient;
