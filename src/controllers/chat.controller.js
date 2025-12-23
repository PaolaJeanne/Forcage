
// ===================================================================
// CONTRÔLEUR SIMPLIFIÉ
// ===================================================================
// src/controllers/chat.controller.js - VERSION SIMPLIFIÉE
// src/controllers/chat.controller.js - VERSION CORRIGÉE
const ChatService = require('../services/chat.service'); // <-- CORRECTION ICI
const Conversation = require('../models/Conversation');  // <-- AJOUT
const User = require('../models/User');                  // <-- AJOUT

class ChatController {
  
  // Récupérer la liste des membres disponibles
  async getTeamMembers(req, res) {
    try {
      const userId = req.user._id;
      
      const members = await ChatService.getAvailableTeamMembers(userId);
      
      res.json({
        success: true,
        data: members
      });
      
    } catch (error) {
      console.error('❌ Erreur liste équipe:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Démarrer une conversation avec un membre précis
  async startDirectChat(req, res) {
    try {
      const userId = req.user._id;
      const { recipientId, message, subject } = req.body;
      
      if (!recipientId) {
        return res.status(400).json({
          success: false,
          message: 'Le destinataire est requis'
        });
      }
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Le message est requis'
        });
      }
      
      const conversation = await ChatService.startDirectConversation(
        userId,
        recipientId,
        message,
        subject
      );
      
      res.status(201).json({
        success: true,
        data: conversation
      });
      
    } catch (error) {
      console.error('❌ Erreur conversation directe:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Client démarre une conversation de support (conseiller auto-assigné)
  async startSupport(req, res) {
    try {
      const userId = req.user._id;
      const { subject, message } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Le message est requis'
        });
      }
      
      const conversation = await ChatService.startSupportConversation(
        userId,
        subject,
        message
      );
      
      res.status(201).json({
        success: true,
        data: conversation
      });
      
    } catch (error) {
      console.error('❌ Erreur démarrage support:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Récupérer le chat d'une demande
  async getDemandeChat(req, res) {
    try {
      const { demandeId } = req.params;
      const userId = req.user._id;
      
      const conversation = await ChatService.getDemandeChat(demandeId, userId);
      
      res.json({
        success: true,
        data: conversation
      });
      
    } catch (error) {
      console.error('❌ Erreur chat demande:', error);
      res.status(error.message.includes('Accès') ? 403 : 500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Envoyer un message
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;
      const { content, attachments = [] } = req.body;
      
      const message = await ChatService.sendSimpleMessage(
        conversationId,
        userId,
        content,
        attachments
      );
      
      // Notifier via Socket.IO si disponible
      if (req.app.get('io')) {
        const io = req.app.get('io');
        const conv = await Conversation.findById(conversationId);
        
        conv.participants.forEach(participantId => {
          if (participantId.toString() !== userId.toString()) {
            io.to(`user_${participantId}`).emit('new_message', {
              conversationId,
              message
            });
          }
        });
      }
      
      res.status(201).json({
        success: true,
        data: message
      });
      
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Récupérer les messages
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;
      const { limit = 50, before } = req.query;
      
      const messages = await ChatService.getMessages(
        conversationId,
        userId,
        parseInt(limit),
        before
      );
      
      res.json({
        success: true,
        data: messages
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Lister les conversations
  async getConversations(req, res) {
    try {
      const userId = req.user._id;
      const { limit, page, archived } = req.query;
      
      const result = await ChatService.getUserConversations(userId, {
        limit: parseInt(limit) || 20,
        page: parseInt(page) || 1,
        archived: archived === 'true'
      });
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erreur liste conversations:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Compter les non lus
  async getUnreadCount(req, res) {
    try {
      const userId = req.user._id;
      const count = await ChatService.getTotalUnreadCount(userId);
      
      res.json({
        success: true,
        data: { unreadCount: count }
      });
      
    } catch (error) {
      console.error('❌ Erreur comptage non lus:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Marquer comme lu
  async markAsRead(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;
      
      await ChatService.markAsRead(conversationId, userId);
      
      res.json({
        success: true,
        message: 'Conversation marquée comme lue'
      });
      
    } catch (error) {
      console.error('❌ Erreur marquer comme lu:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ChatController();