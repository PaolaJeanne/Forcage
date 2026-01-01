/**
 * src/services/api.js
 * Main entry point for API services.
 * Refactored to use modular services.
 */

import { apiClient } from './core/api.client';
import { authService } from './modules/auth.service';
import { demandeService } from './modules/demande.service';
import { workflowService } from './modules/workflow.service';
import { dashboardService } from './modules/dashboard.service';
import { notificationService } from './modules/notification.service';
import { adminService } from './modules/admin.service';
// Using commonJS require for misc services if needed or just ES imports
import { exportService, healthService } from './modules/misc.service';
import { smsService } from './modules/sms.service';
import { signatureService } from './modules/signature.service';
import { documentService } from './modules/document.service';
import { auditService } from './modules/audit.service';
import { chatService } from './modules/chat.service';

// Aggregate all services into a single object to maintain compatibility 
// with the simplified "apiService" usage style.
const apiService = {
    // Core (exposed for custom usage if needed)
    getToken: () => apiClient.getToken(),
    request: (endpoint, options) => apiClient.request(endpoint, options),
    cleanFilters: (filters) => apiClient.cleanFilters(filters),
    getQueryString: (filters) => apiClient.getQueryString(filters),

    // Modules
    ...authService,
    ...demandeService,
    ...workflowService,
    ...dashboardService,
    ...notificationService,
    ...adminService,
    ...exportService,
    ...healthService,
    ...smsService,
    ...signatureService,
    ...documentService,
    ...auditService,
    ...chatService
};

export default apiService;
