// src/controllers/chat.controller.js - VERSION CORRIGÉE
const ChatService = require('../services/chat.service');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../utils/logger.util');

class ChatController {

  // Récupérer la liste des membres disponibles
  async getTeamMembers(req, res) {
    try {
      const userId = req.user.userId || req.user._id;
      const members = await ChatService.getAvailableTeamMembers(userId);

      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      logger.error('Erreur getTeamMembers', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Démarrer une conversation avec un ou plusieurs membres
  async startmessages(req, res) {
    try {
      const userId = req.user.userId || req.user._id;
      const { recipientId, recipients, message, subject, destinataire, name } = req.body;

      logger.debug('startmessages - Body reçu', req.body);
      logger.debug('startmessages - User', { userId });

      // Accepter plusieurs formats de destinataires pour compatibilité frontend
      let recipientIds = null;
      
      if (recipients && Array.isArray(recipients)) {
        recipientIds = recipients;
        logger.debug('Using recipients array', recipients);
      } else if (recipientId) {
        recipientIds = [recipientId];
        logger.debug('Using recipientId', recipientId);
      } else if (destinataire) {
        recipientIds = [destinataire];
        logger.debug('Using destinataire', destinataire);
      }

      if (!recipientIds || recipientIds.length === 0) {
        logger.warn('No recipients found in request');
        return res.status(400).json({
          success: false,
          message: 'Le destinataire est requis'
        });
      }

      // Utiliser le nom fourni ou le subject
      const conversationSubject = name || subject;

      // Vérifier si une conversation existe déjà avec ces participants
      let conversation = null;
      
      if (recipientIds.length === 1) {
        // Conversation directe - chercher une conversation existante
        conversation = await Conversation.findOne({
          type: 'direct',
          participants: { 
            $all: [userId, recipientIds[0]], 
            $size: 2 
          },
          isArchived: false
        }).populate('participants', 'nom prenom email role avatar');

        // Si elle n'existe pas, la créer
        if (!conversation) {
          const [sender, recipient] = await Promise.all([
            User.findById(userId).select('nom prenom email role avatar'),
            User.findById(recipientIds[0]).select('nom prenom email role avatar')
          ]);

          if (!sender || !recipient) {
            return res.status(404).json({
              success: false,
              message: 'Utilisateur non trouvé'
            });
          }

          // Créer le titre avec les noms complets
          const conversationTitle = `${recipient.prenom} ${recipient.nom}`;

          conversation = await Conversation.create({
            type: 'direct',
            participants: [userId, recipientIds[0]],
            title: conversationTitle,
            createdBy: userId,
            lastActivityAt: new Date()
          });

          // Populer les participants après création
          conversation = await Conversation.findById(conversation._id)
            .populate('participants', 'nom prenom email role avatar');
        }
      } else {
        // Conversation de groupe
        const participants = await User.find({
          _id: { $in: [...recipientIds, userId] }
        }).select('nom prenom email role avatar');

        const participantNames = participants
          .filter(p => p._id.toString() !== userId.toString())
          .map(p => `${p.prenom} ${p.nom}`)
          .join(', ');

        conversation = await Conversation.create({
          type: 'group',
          participants: [userId, ...recipientIds],
          title: conversationSubject || `Groupe: ${participantNames}`,
          createdBy: userId,
          lastActivityAt: new Date()
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('participants', 'nom prenom email role avatar');
      }

      // Créer le premier message si fourni
      let firstMessage = null;
      if (message && message.trim()) {
        const newMessage = await Message.create({
          conversationId: conversation._id,
          sender: userId,
          content: message.trim(),
          type: 'text',
          readBy: [{ userId, readAt: new Date() }]
        });

        firstMessage = await Message.findById(newMessage._id)
          .populate('sender', 'nom prenom email role avatar');

        // Mettre à jour lastMessage dans la conversation
        conversation.lastMessage = {
          sender: firstMessage.sender._id,
          content: firstMessage.content,
          type: 'text',
          createdAt: firstMessage.createdAt
        };
        await conversation.save();
      }

      // Réponse complète
      res.status(201).json({
        success: true,
        message: 'Conversation créée avec succès',
        data: {
          conversationId: conversation._id,
          _id: conversation._id,
          conversation: {
            _id: conversation._id,
            type: conversation.type,
            title: conversation.title,
            participants: conversation.participants,
            lastMessage: conversation.lastMessage,
            createdAt: conversation.createdAt,
            lastActivityAt: conversation.lastActivityAt,
            unreadCount: 0
          },
          firstMessage: firstMessage ? {
            _id: firstMessage._id,
            content: firstMessage.content,
            sender: firstMessage.sender,
            createdAt: firstMessage.createdAt
          } : null
        }
      });

    } catch (error) {
      logger.error('Erreur startmessages', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la création de la conversation'
      });
    }
  }

  // Envoyer un message
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.userId || req.user._id;
      const { content, attachments = [] } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Le message ne peut pas être vide'
        });
      }

      // Vérifier que la conversation existe et que l'utilisateur y participe
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation non trouvée'
        });
      }

      if (!conversation.isParticipant(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé'
        });
      }

      // Créer le message
      const message = await Message.create({
        conversationId,
        sender: userId,
        content: content.trim(),
        type: attachments.length > 0 ? 'file' : 'text',
        attachments,
        readBy: [{ userId, readAt: new Date() }]
      });

      // Populer le sender
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'nom prenom email role avatar');

      // Mettre à jour la conversation
      conversation.lastMessage = {
        sender: userId,
        content: content.trim(),
        type: 'text',
        createdAt: new Date()
      };
      conversation.lastActivityAt = new Date();
      
      // Incrémenter le compteur de non-lus pour les autres participants
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId.toString()) {
          const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
          conversation.unreadCount.set(participantId.toString(), currentCount + 1);
        }
      });

      await conversation.save();

      // Notifier via Socket.IO si disponible
      if (req.app.get('io')) {
        const io = req.app.get('io');
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== userId.toString()) {
            io.to(`user_${participantId}`).emit('new_message', {
              conversationId,
              message: {
                _id: populatedMessage._id,
                content: populatedMessage.content,
                sender: populatedMessage.sender,
                createdAt: populatedMessage.createdAt,
                isOwn: false
              }
            });
          }
        });
      }

      res.status(201).json({
        success: true,
        message: 'Message envoyé',
        data: {
          _id: populatedMessage._id,
          content: populatedMessage.content,
          sender: populatedMessage.sender,
          createdAt: populatedMessage.createdAt,
          type: populatedMessage.type,
          isOwn: true
        }
      });

    } catch (error) {
      logger.error('Erreur sendMessage', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'envoi du message'
      });
    }
  }

  // Récupérer les messages d'une conversation
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.userId || req.user._id;
      const { limit = 50, before } = req.query;

      // Vérifier l'accès
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation non trouvée'
        });
      }

      if (!conversation.isParticipant(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé'
        });
      }

      // Construire la requête
      const query = { conversationId };
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      // Récupérer les messages
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('sender', 'nom prenom email role avatar')
        .lean();

      // Inverser l'ordre pour avoir les plus anciens en premier
      messages.reverse();

      // Ajouter le flag isOwn
      const messagesWithOwnership = messages.map(msg => ({
        ...msg,
        isOwn: msg.sender._id.toString() === userId.toString()
      }));

      // Marquer comme lu
      await conversation.resetUnreadCount(userId);

      res.json({
        success: true,
        data: messagesWithOwnership
      });

    } catch (error) {
      logger.error('Erreur getMessages', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des messages'
      });
    }
  }

  // Lister les conversations
  async getConversations(req, res) {
    try {
      const userId = req.user.userId || req.user._id;
      const { limit = 20, page = 1, archived = false } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Ne pas utiliser .lean() pour préserver les Maps
      const conversations = await Conversation.find({
        participants: userId,
        isArchived: archived === 'true'
      })
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('participants', 'nom prenom email role avatar')
        .populate('lastMessage.sender', 'nom prenom');

      // Enrichir avec les infos pour l'affichage
      const enrichedConversations = conversations.map(conv => {
        const convObj = conv.toObject ? conv.toObject() : conv;
        
        const otherParticipants = convObj.participants.filter(
          p => p._id.toString() !== userId.toString()
        );

        // Calculer le nom d'affichage
        let displayName = convObj.title;
        if (convObj.type === 'direct' && otherParticipants.length > 0) {
          const other = otherParticipants[0];
          displayName = `${other.prenom} ${other.nom}`;
        } else if (!displayName && otherParticipants.length > 0) {
          displayName = otherParticipants
            .map(p => `${p.prenom} ${p.nom}`)
            .join(', ');
        }

        // Gérer unreadCount - peut être une Map ou un objet
        let unreadCount = 0;
        if (conv.unreadCount) {
          if (typeof conv.unreadCount.get === 'function') {
            // C'est une Map
            unreadCount = conv.unreadCount.get(userId.toString()) || 0;
          } else if (typeof convObj.unreadCount === 'object') {
            // C'est un objet plain
            unreadCount = convObj.unreadCount[userId.toString()] || 0;
          }
        }

        return {
          ...convObj,
          name: displayName,
          unreadCount,
          lastMessage: convObj.lastMessage?.content || 'Aucun message'
        };
      });

      const total = await Conversation.countDocuments({
        participants: userId,
        isArchived: archived === 'true'
      });

      res.json({
        success: true,
        data: {
          conversations: enrichedConversations,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      logger.error('Erreur getConversations', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Compter les non lus
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.userId || req.user._id;

      const conversations = await Conversation.find({
        participants: userId,
        isArchived: false
      }).select('unreadCount');

      let totalUnread = 0;
      conversations.forEach(conv => {
        if (conv.unreadCount) {
          if (typeof conv.unreadCount.get === 'function') {
            // C'est une Map
            totalUnread += conv.unreadCount.get(userId.toString()) || 0;
          } else if (typeof conv.unreadCount === 'object') {
            // C'est un objet plain
            totalUnread += conv.unreadCount[userId.toString()] || 0;
          }
        }
      });

      res.json({
        success: true,
        data: { unreadCount: totalUnread }
      });

    } catch (error) {
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
      const userId = req.user.userId || req.user._id;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation non trouvée'
        });
      }

      await conversation.resetUnreadCount(userId);

      res.json({
        success: true,
        message: 'Conversation marquée comme lue'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Support et demande (gardez vos méthodes existantes)
  async startSupport(req, res) {
    try {
      const userId = req.user.userId || req.user._id;
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
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getDemandeChat(req, res) {
    try {
      const { demandeId } = req.params;
      const userId = req.user.userId || req.user._id;

      const conversation = await ChatService.getDemandeChat(demandeId, userId);

      res.json({
        success: true,
        data: conversation
      });

    } catch (error) {
      res.status(error.message.includes('Accès') ? 403 : 500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ChatController();