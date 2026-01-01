/**
 * src/services/modules/chat.service.js
 */
import { apiClient } from '../core/api.client';

export const chatService = {
    async getChatTeamMembers() { return apiClient.request('/chat/team'); },
    async startChatMessages() { return apiClient.request('/chat/messages', { method: 'POST' }); },
    async startSupportConversation() { return apiClient.request('/chat/support', { method: 'POST' }); },
    async getDemandeChat(demandeId) { return apiClient.request(`/chat/demande/${demandeId}`); },
    async getConversations() { return apiClient.request('/chat/conversations'); },
    async getChatUnreadCount() { return apiClient.request('/chat/unread'); },
    async getConversationMessages(conversationId) { return apiClient.request(`/chat/${conversationId}/messages`); },
    async sendChatMessage(conversationId, content) {
        return apiClient.request(`/chat/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ message: content })
        });
    },
    async markChatAsRead(conversationId) {
        return apiClient.request(`/chat/${conversationId}/read`, { method: 'PATCH' });
    }
};
