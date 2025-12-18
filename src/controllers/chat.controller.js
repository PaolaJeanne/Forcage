// src/controllers/chat.controller.js - Version complète
const ChatService = require('../services/chat.service');
const { validationResult } = require('express-validator');

class ChatController {
  
  // ==================== CONVERSATIONS ====================
  
  async getConversations(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const filters = {
        type: req.query.type,
        archived: req.query.archived === 'true',
        limit: req.query.limit || 50,
        page: req.query.page || 1,
        search: req.query.search
      };
      
      const result = await ChatService.getUserConversations(userId, filters);
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erreur getConversations:', error);
      res.status(error.message.includes('non trouvée') ? 404 : 500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des conversations'
      });
    }
  }
  
  async getUnreadCount(req, res) {
    try {
      const userId = req.user._id;
      
      const conversations = await ChatService.getUserConversations(userId, {
        archived: false,
        limit: 1000
      });
      
      const totalUnread = conversations.conversations.reduce((total, conv) => {
        return total + (conv.unreadMessages || 0);
      }, 0);
      
      res.json({
        success: true,
        data: {
          totalUnread,
          conversations: conversations.conversations.map(conv => ({
            id: conv._id,
            unread: conv.unreadMessages || 0,
            title: conv.title
          }))
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur getUnreadCount:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du comptage des messages non lus'
      });
    }
  }
  
  async createConversation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const { participants, demandeId, title, description, type } = req.body;
      
      // S'assurer que l'utilisateur fait partie des participants
      const allParticipants = [...new Set([userId.toString(), ...participants])];
      
      const conversation = await ChatService.getOrCreateConversation(allParticipants, {
        type: type || 'support',
        demandeId,
        title,
        description,
        addWelcomeMessage: true,
        createdBy: userId
      });
      
      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Conversation créée avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur createConversation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la création de la conversation'
      });
    }
  }
  
  async getConversation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const userId = req.user._id;
      
      const conversation = await ChatService.getConversationById(conversationId, userId);
      
      res.json({
        success: true,
        data: conversation
      });
      
    } catch (error) {
      console.error('❌ Erreur getConversation:', error);
      res.status(error.message.includes('non trouvée') ? 404 : 403).json({
        success: false,
        message: error.message || 'Conversation non trouvée'
      });
    }
  }
  
  async getOrCreateDemandeConversation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { demandeId } = req.params;
      const userId = req.user._id;
      
      const conversation = await ChatService.getOrCreateDemandeConversation(demandeId, userId);
      
      res.json({
        success: true,
        data: conversation,
        message: 'Conversation de demande récupérée/créée avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur getOrCreateDemandeConversation:', error);
      res.status(error.message.includes('non trouvée') ? 404 : 403).json({
        success: false,
        message: error.message || 'Erreur lors de la gestion de la conversation'
      });
    }
  }
  
  async archiveConversation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const userId = req.user._id;
      
      const conversation = await ChatService.archiveConversation(conversationId, userId);
      
      res.json({
        success: true,
        data: conversation,
        message: 'Conversation archivée avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur archiveConversation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'archivage de la conversation'
      });
    }
  }
  
  async unarchiveConversation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const userId = req.user._id;
      
      const conversation = await ChatService.unarchiveConversation(conversationId, userId);
      
      res.json({
        success: true,
        data: conversation,
        message: 'Conversation désarchivée avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur unarchiveConversation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du désarchivage de la conversation'
      });
    }
  }
  
  async markAsRead(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const userId = req.user._id;
      
      await ChatService.markConversationAsRead(conversationId, userId);
      
      // Émettre un événement Socket.IO si disponible
      if (req.app.get('socketio')) {
        const io = req.app.get('socketio');
        io.to(`user_${userId}`).emit('conversation_read', {
          conversationId
        });
      }
      
      res.json({
        success: true,
        message: 'Conversation marquée comme lue'
      });
      
    } catch (error) {
      console.error('❌ Erreur markAsRead:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du marquage comme lu'
      });
    }
  }
  
  async addParticipant(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const { userId } = req.body;
      const currentUserId = req.user._id;
      
      const conversation = await ChatService.addParticipant(conversationId, userId, currentUserId);
      
      res.json({
        success: true,
        data: conversation,
        message: 'Participant ajouté avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur addParticipant:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'ajout du participant'
      });
    }
  }
  
  async removeParticipant(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId, userId } = req.params;
      const currentUserId = req.user._id;
      
      const conversation = await ChatService.removeParticipant(conversationId, userId, currentUserId);
      
      res.json({
        success: true,
        data: conversation,
        message: 'Participant retiré avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur removeParticipant:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du retrait du participant'
      });
    }
  }
  
  // ==================== MESSAGES ====================
  
  async sendMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const userId = req.user._id;
      const { content, attachments, replyTo, mentions } = req.body;
      
      // Vérifier qu'il y a au moins du contenu ou des pièces jointes
      if (!content && (!attachments || attachments.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Le message doit contenir du texte ou des pièces jointes'
        });
      }
      
      const message = await ChatService.sendMessage(
        conversationId,
        userId,
        content || '',
        {
          type: req.body.type || 'text',
          attachments,
          replyTo,
          mentions,
          metadata: req.body.metadata
        }
      );
      
      // Émettre un événement Socket.IO si disponible
      if (req.app.get('socketio')) {
        const io = req.app.get('socketio');
        
        // Envoyer à tous les participants de la conversation
        const Conversation = require('../models/Conversation');
        const conversation = await Conversation.findById(conversationId).select('participants');
        
        if (conversation) {
          conversation.participants.forEach(participantId => {
            if (participantId.toString() !== userId.toString()) {
              io.to(`user_${participantId}`).emit('new_message', {
                conversationId,
                message
              });
            }
          });
        }
        
        // Émettre également à l'expéditeur pour la confirmation
        io.to(`user_${userId}`).emit('message_sent', {
          conversationId,
          messageId: message._id
        });
      }
      
      res.status(201).json({
        success: true,
        data: message,
        message: 'Message envoyé avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur sendMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'envoi du message'
      });
    }
  }
  
  async getMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId } = req.params;
      const userId = req.user._id;
      const filters = {
        limit: req.query.limit || 50,
        before: req.query.before,
        after: req.query.after,
        includeDeleted: req.query.includeDeleted === 'true'
      };
      
      const messages = await ChatService.getConversationMessages(conversationId, userId, filters);
      
      res.json({
        success: true,
        data: messages
      });
      
    } catch (error) {
      console.error('❌ Erreur getMessages:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des messages'
      });
    }
  }
  
  async reactToMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { conversationId, messageId } = req.params;
      const userId = req.user._id;
      const { emoji, action = 'add' } = req.body;
      
      // Vérifier l'accès à la conversation
      const Conversation = require('../models/Conversation');
      const hasAccess = await Conversation.exists({
        _id: conversationId,
        participants: userId
      });
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      
      // Ajouter ou retirer la réaction
      const Message = require('../models/Message');
      const message = await Message.findById(messageId);
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }
      
      if (action === 'add') {
        await message.addReaction(userId, emoji);
      } else {
        await message.removeReaction(userId);
      }
      
      // Émettre un événement Socket.IO si disponible
      if (req.app.get('socketio')) {
        const io = req.app.get('socketio');
        io.to(`conversation_${conversationId}`).emit('message_reaction', {
          conversationId,
          messageId,
          userId,
          emoji: action === 'add' ? emoji : null,
          action
        });
      }
      
      res.json({
        success: true,
        data: message,
        message: action === 'add' ? 'Réaction ajoutée' : 'Réaction retirée'
      });
      
    } catch (error) {
      console.error('❌ Erreur reactToMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la gestion de la réaction'
      });
    }
  }
  
  async editMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { messageId } = req.params;
      const userId = req.user._id;
      const { content } = req.body;
      
      const message = await ChatService.editMessage(messageId, userId, content);
      
      // Émettre un événement Socket.IO si disponible
      if (req.app.get('socketio')) {
        const io = req.app.get('socketio');
        
        // Trouver la conversation du message
        const Message = require('../models/Message');
        const fullMessage = await Message.findById(messageId)
          .populate('sender', 'nom prenum avatar')
          .populate('conversationId', 'participants');
        
        if (fullMessage && fullMessage.conversationId) {
          fullMessage.conversationId.participants.forEach(participantId => {
            io.to(`user_${participantId}`).emit('message_edited', {
              conversationId: fullMessage.conversationId._id,
              messageId,
              content: message.content,
              editedAt: message.edited.editedAt
            });
          });
        }
      }
      
      res.json({
        success: true,
        data: message,
        message: 'Message modifié avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur editMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la modification du message'
      });
    }
  }
  
  async deleteMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { messageId } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;
      
      const message = await ChatService.deleteMessage(messageId, userId, reason);
      
      // Émettre un événement Socket.IO si disponible
      if (req.app.get('socketio')) {
        const io = req.app.get('socketio');
        
        // Trouver la conversation du message
        const Message = require('../models/Message');
        const fullMessage = await Message.findById(messageId)
          .populate('conversationId', 'participants');
        
        if (fullMessage && fullMessage.conversationId) {
          fullMessage.conversationId.participants.forEach(participantId => {
            io.to(`user_${participantId}`).emit('message_deleted', {
              conversationId: fullMessage.conversationId._id,
              messageId
            });
          });
        }
      }
      
      res.json({
        success: true,
        data: message,
        message: 'Message supprimé avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur deleteMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la suppression du message'
      });
    }
  }
  
  async restoreMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { messageId } = req.params;
      const userId = req.user._id;
      
      // Restaurer le message
      const Message = require('../models/Message');
      const message = await Message.findById(messageId);
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }
      
      await message.restore(userId);
      
      res.json({
        success: true,
        data: message,
        message: 'Message restauré avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur restoreMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la restauration du message'
      });
    }
  }
  
  async getMessageReadInfo(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { messageId } = req.params;
      const userId = req.user._id;
      
      const readInfo = await ChatService.getMessageReadInfo(messageId, userId);
      
      res.json({
        success: true,
        data: readInfo
      });
      
    } catch (error) {
      console.error('❌ Erreur getMessageReadInfo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des infos de lecture'
      });
    }
  }
  
  async pinMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { messageId } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;
      
      const Message = require('../models/Message');
      const message = await Message.findById(messageId);
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }
      
      await message.pin(userId, reason);
      
      res.json({
        success: true,
        data: message,
        message: 'Message épinglé avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur pinMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'épinglage du message'
      });
    }
  }
  
  async unpinMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { messageId } = req.params;
      
      const Message = require('../models/Message');
      const message = await Message.findById(messageId);
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }
      
      await message.unpin();
      
      res.json({
        success: true,
        data: message,
        message: 'Message désépinglé avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur unpinMessage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du désépinglage du message'
      });
    }
  }
  
  // ==================== STATISTIQUES & RECHERCHE ====================
  
  async getStats(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const filters = {
        periode: req.query.periode || '30d'
      };
      
      const stats = await ChatService.getChatStats(userId, filters);
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('❌ Erreur getStats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des statistiques'
      });
    }
  }
  
  async searchMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const { q: query } = req.query;
      
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'La recherche doit contenir au moins 2 caractères'
        });
      }
      
      const filters = {
        limit: req.query.limit || 20,
        page: req.query.page || 1,
        conversationId: req.query.conversationId
      };
      
      const results = await ChatService.searchMessages(userId, query.trim(), filters);
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      console.error('❌ Erreur searchMessages:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la recherche'
      });
    }
  }
  
  async searchConversations(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const { q: query } = req.query;
      
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'La recherche doit contenir au moins 2 caractères'
        });
      }
      
      const filters = {
        limit: req.query.limit || 20,
        page: req.query.page || 1
      };
      
      const results = await ChatService.searchConversations(userId, query.trim(), filters);
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      console.error('❌ Erreur searchConversations:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la recherche'
      });
    }
  }
  
  // ==================== PARAMÈTRES ====================
  
  async getChatSettings(req, res) {
    try {
      const userId = req.user._id;
      
      const ChatSettings = require('../models/ChatSettings');
      let settings = await ChatSettings.findOne({ userId });
      
      // Créer des paramètres par défaut s'ils n'existent pas
      if (!settings) {
        settings = await ChatSettings.create({ userId });
      }
      
      res.json({
        success: true,
        data: settings
      });
      
    } catch (error) {
      console.error('❌ Erreur getChatSettings:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des paramètres'
      });
    }
  }
  
  async updateChatSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const updates = req.body;
      
      const ChatSettings = require('../models/ChatSettings');
      const settings = await ChatSettings.findOneAndUpdate(
        { userId },
        { $set: updates },
        { new: true, upsert: true }
      );
      
      res.json({
        success: true,
        data: settings,
        message: 'Paramètres mis à jour avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur updateChatSettings:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la mise à jour des paramètres'
      });
    }
  }
  
  async blockUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const { userId: userToBlockId } = req.params;
      
      const ChatSettings = require('../models/ChatSettings');
      let settings = await ChatSettings.findOne({ userId });
      
      if (!settings) {
        settings = await ChatSettings.create({ userId });
      }
      
      await settings.blockUser(userToBlockId);
      
      res.json({
        success: true,
        message: 'Utilisateur bloqué avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur blockUser:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du blocage de l\'utilisateur'
      });
    }
  }
  
  async unblockUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const userId = req.user._id;
      const { userId: userToUnblockId } = req.params;
      
      const ChatSettings = require('../models/ChatSettings');
      const settings = await ChatSettings.findOne({ userId });
      
      if (!settings) {
        return res.status(404).json({
          success: false,
          message: 'Paramètres non trouvés'
        });
      }
      
      await settings.unblockUser(userToUnblockId);
      
      res.json({
        success: true,
        message: 'Utilisateur débloqué avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur unblockUser:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du déblocage de l\'utilisateur'
      });
    }
  }
}

module.exports = new ChatController();