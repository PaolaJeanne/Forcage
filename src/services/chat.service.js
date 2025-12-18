// src/services/chat.service.js
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const DemandeForçage = require('../models/DemandeForçage');
const NotificationService = require('./notification.service'); // ⭐ IMPORTATION DES NOTIFICATIONS

class ChatService {
  
  // ==================== CONVERSATIONS ====================
  
  /**
   * Créer ou récupérer une conversation
   * @param {Array} participants - IDs des participants
   * @param {Object} options - Options de la conversation
   * @returns {Object} Conversation
   */
  async getOrCreateConversation(participants, options = {}) {
    try {
      // Vérifier que tous les participants existent
      const users = await User.find({ _id: { $in: participants } });
      if (users.length !== participants.length) {
        throw new Error('Un ou plusieurs participants non trouvés');
      }
      
      // Normaliser les IDs pour la comparaison
      const normalizedParticipants = participants.map(p => p.toString()).sort();
      
      // Chercher une conversation existante
      let conversation = await Conversation.findOne({
        type: options.type || 'support',
        isArchived: false
      });
      
      // Filtrer par participants si spécifié
      if (!conversation && options.exactParticipants !== false) {
        conversation = await Conversation.findOne({
          participants: { 
            $all: participants,
            $size: participants.length 
          },
          type: options.type || 'support',
          isArchived: false
        });
      }
      
      // Si pas de conversation, en créer une nouvelle
      if (!conversation) {
        conversation = await Conversation.create({
          participants,
          type: options.type || 'support',
          demandeId: options.demandeId,
          title: options.title || this.generateConversationTitle(participants, users),
          unreadCount: new Map(),
          createdBy: options.createdBy
        });
        
        // ⭐ NOTIFICATION : Nouvelle conversation
        if (options.createdBy) {
          await NotificationService.notifyNewConversation(conversation._id, options.createdBy);
        }
        
        // Ajouter un message système de bienvenue
        if (options.addWelcomeMessage !== false) {
          await this.addSystemMessage(
            conversation._id,
            'conversation_created',
            { 
              participants: users.map(u => u.prenom || u.prenum + ' ' + u.nom),
              createdBy: options.createdBy || 'système'
            },
            options.createdBy // ⭐ Utiliser le vrai utilisateur comme expéditeur
          );
        }
        
        console.log(`✅ Conversation créée: ${conversation._id}`);
      }
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur création conversation:', error);
      throw error;
    }
  }
  
  /**
   * Obtenir ou créer une conversation pour une demande spécifique
   * @param {String} demandeId - ID de la demande
   * @param {String} userId - ID de l'utilisateur faisant la requête
   * @returns {Object} Conversation
   */
  async getOrCreateDemandeConversation(demandeId, userId) {
    try {
      // Récupérer la demande
      const demande = await DemandeForçage.findById(demandeId)
        .populate('clientId', '_id nom prenum')
        .populate('conseillerId', '_id nom prenum');
      
      if (!demande) {
        throw new Error('Demande non trouvée');
      }
      
      // Participants de base : client et conseiller
      const baseParticipants = [
        demande.clientId._id,
        demande.conseillerId._id
      ];
      
      // Vérifier si l'utilisateur fait partie des participants de base
      const userIsBaseParticipant = baseParticipants.some(
        p => p.toString() === userId.toString()
      );
      
      // Si l'utilisateur n'est ni client ni conseiller, vérifier son rôle
      if (!userIsBaseParticipant) {
        const user = await User.findById(userId);
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }
        
        // Seuls les rôles autorisés peuvent accéder à la conversation
        const authorizedRoles = ['admin', 'dga', 'risques', 'support'];
        if (!authorizedRoles.includes(user.role)) {
          throw new Error('Accès non autorisé à cette conversation');
        }
        
        // Ajouter l'utilisateur aux participants
        baseParticipants.push(userId);
      }
      
      // Ajouter tous les administrateurs et responsables
      const additionalUsers = await User.find({
        role: { $in: ['admin', 'dga', 'risques'] },
        _id: { $nin: baseParticipants }
      }).select('_id');
      
      const allParticipants = [
        ...baseParticipants,
        ...additionalUsers.map(u => u._id)
      ];
      
      // Créer ou récupérer la conversation
      const conversation = await this.getOrCreateConversation(allParticipants, {
        type: 'support',
        demandeId,
        title: `Discussion - Demande #${demande.numeroReference}`,
        addWelcomeMessage: true,
        exactParticipants: false,
        createdBy: userId
      });
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur conversation demande:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer les conversations d'un utilisateur
   * @param {String} userId - ID de l'utilisateur
   * @param {Object} filters - Filtres de recherche
   * @returns {Object} Conversations et pagination
   */
  async getUserConversations(userId, filters = {}) {
    try {
      const { 
        type, 
        archived = false, 
        limit = 50, 
        page = 1,
        search 
      } = filters;
      
      const skip = (page - 1) * limit;
      
      let query = {
        participants: userId,
        isArchived: archived
      };
      
      if (type) query.type = type;
      
      // Recherche par titre
      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }
      
      const conversations = await Conversation.find(query)
        .sort({ 'lastMessage.createdAt': -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'participants',
          select: 'nom prenum email role avatar',
          match: { _id: { $ne: userId } }
        })
        .populate('demandeId', 'numeroReference montant statut')
        .lean();
      
      // Nettoyer les participants null (si match ne trouve pas)
      conversations.forEach(conv => {
        conv.participants = conv.participants.filter(p => p !== null);
        
        // Ajouter l'utilisateur courant aux participants pour le frontend
        conv.allParticipants = [userId, ...conv.participants.map(p => p._id)];
        
        // Compter les messages non lus
        conv.unreadMessages = conv.unreadCount?.get(userId.toString()) || 0;
        
        // Générer un titre si absent
        if (!conv.title && conv.participants.length > 0) {
          conv.title = conv.participants.map(p => `${p.prenum} ${p.nom}`).join(', ');
        }
      });
      
      const total = await Conversation.countDocuments(query);
      
      return {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur conversations utilisateur:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer une conversation par son ID
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur
   * @returns {Object} Conversation
   */
  async getConversationById(conversationId, userId) {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      })
      .populate({
        path: 'participants',
        select: 'nom prenum email role avatar telephone'
      })
      .populate({
        path: 'demandeId',
        select: 'numeroReference montant statut createdAt clientId conseillerId',
        populate: [
          { path: 'clientId', select: 'nom prenum email' },
          { path: 'conseillerId', select: 'nom prenum email' }
        ]
      })
      .lean();
      
      if (!conversation) {
        throw new Error('Conversation non trouvée ou accès refusé');
      }
      
      // Compter les messages non lus
      conversation.unreadMessages = conversation.unreadCount?.get(userId.toString()) || 0;
      
      // Marquer comme lu pour cet utilisateur
      await this.markConversationAsRead(conversationId, userId);
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur récupération conversation:', error);
      throw error;
    }
  }
  
  /**
   * Archiver une conversation
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur
   * @returns {Object} Conversation archivée
   */
  async archiveConversation(conversationId, userId) {
    try {
      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          participants: userId
        },
        {
          $set: { isArchived: true },
          $addToSet: { 
            archivedBy: { 
              userId, 
              archivedAt: new Date() 
            } 
          }
        },
        { new: true }
      );
      
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }
      
      // Ajouter un message système
      await this.addSystemMessage(
        conversationId,
        'conversation_archived',
        { userId }
      );
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur archivage conversation:', error);
      throw error;
    }
  }
  
  /**
   * Désarchiver une conversation
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur
   * @returns {Object} Conversation désarchivée
   */
  async unarchiveConversation(conversationId, userId) {
    try {
      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          participants: userId,
          'archivedBy.userId': userId
        },
        {
          $set: { isArchived: false },
          $pull: { 
            archivedBy: { userId } 
          }
        },
        { new: true }
      );
      
      if (!conversation) {
        throw new Error('Conversation non trouvée ou non archivée par cet utilisateur');
      }
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur désarchivage conversation:', error);
      throw error;
    }
  }
  
  /**
   * Ajouter un participant à une conversation
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur à ajouter
   * @param {String} addedBy - ID de l'utilisateur qui ajoute
   * @returns {Object} Conversation mise à jour
   */
  async addParticipant(conversationId, userId, addedBy) {
    try {
      // Vérifier que l'ajouteur fait partie de la conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: addedBy
      });
      
      if (!conversation) {
        throw new Error('Accès non autorisé');
      }
      
      // Vérifier que l'utilisateur à ajouter existe
      const userToAdd = await User.findById(userId);
      if (!userToAdd) {
        throw new Error('Utilisateur à ajouter non trouvé');
      }
      
      // Vérifier si l'utilisateur est déjà participant
      if (conversation.participants.includes(userId)) {
        throw new Error('Cet utilisateur est déjà participant');
      }
      
      // Ajouter l'utilisateur
      conversation.participants.push(userId);
      await conversation.save();
      
      // ⭐ NOTIFICATION : Utilisateur ajouté
      await NotificationService.notifyUserAddedToConversation(conversationId, userId, addedBy);
      
      // Ajouter un message système
      await this.addSystemMessage(
        conversationId,
        'user_joined',
        {
          userId,
          userName: `${userToAdd.prenum} ${userToAdd.nom}`,
          addedBy
        },
        addedBy
      );
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur ajout participant:', error);
      throw error;
    }
  }
  
  /**
   * Retirer un participant d'une conversation
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur à retirer
   * @param {String} removedBy - ID de l'utilisateur qui retire
   * @returns {Object} Conversation mise à jour
   */
  async removeParticipant(conversationId, userId, removedBy) {
    try {
      // Vérifier que celui qui retire fait partie de la conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: removedBy
      });
      
      if (!conversation) {
        throw new Error('Accès non autorisé');
      }
      
      // Vérifier que l'utilisateur à retirer existe
      const userToRemove = await User.findById(userId);
      if (!userToRemove) {
        throw new Error('Utilisateur à retirer non trouvé');
      }
      
      // Ne pas permettre de retirer le dernier participant
      if (conversation.participants.length <= 1) {
        throw new Error('Impossible de retirer le dernier participant');
      }
      
      // Retirer l'utilisateur
      conversation.participants = conversation.participants.filter(
        p => p.toString() !== userId.toString()
      );
      await conversation.save();
      
      // Ajouter un message système
      await this.addSystemMessage(
        conversationId,
        'user_left',
        {
          userId,
          userName: `${userToRemove.prenum} ${userToRemove.nom}`,
          removedBy
        },
        removedBy
      );
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Erreur retrait participant:', error);
      throw error;
    }
  }
  
  // ==================== MESSAGES ====================
  
  /**
   * Envoyer un message
   * @param {String} conversationId - ID de la conversation
   * @param {String} senderId - ID de l'expéditeur
   * @param {String} content - Contenu du message
   * @param {Object} options - Options du message
   * @returns {Object} Message envoyé
   */
  async sendMessage(conversationId, senderId, content, options = {}) {
    try {
      // Vérifier que l'expéditeur fait partie de la conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: senderId
      });
      
      if (!conversation) {
        throw new Error('Conversation non trouvée ou accès refusé');
      }
      
      // Vérifier si la conversation est archivée
      if (conversation.isArchived) {
        throw new Error('Impossible d\'envoyer un message dans une conversation archivée');
      }
      
      // Créer le message
      const messageData = {
        conversationId,
        sender: senderId,
        content: content.trim(),
        type: options.type || 'text',
        replyTo: options.replyTo,
        metadata: options.metadata || {}
      };
      
      // Gérer les pièces jointes
      if (options.attachments && options.attachments.length > 0) {
        messageData.attachments = options.attachments.map(att => ({
          filename: att.filename,
          url: att.url,
          type: att.type || this.getFileType(att.filename),
          size: att.size,
          uploadedAt: new Date()
        }));
        
        // Si c'est uniquement des pièces jointes sans texte
        if (!content.trim() && options.attachments.length > 0) {
          messageData.content = `A envoyé ${options.attachments.length} fichier(s)`;
          messageData.type = 'file';
        }
      }
      
      // Gérer les mentions
      if (options.mentions && options.mentions.length > 0) {
        messageData.mentions = options.mentions;
        messageData.metadata.mentions = options.mentions;
      }
      
      const message = await Message.create(messageData);
      
      // Mettre à jour le dernier message de la conversation
      conversation.lastMessage = {
        sender: senderId,
        content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        type: options.type || 'text',
        createdAt: new Date(),
        attachments: options.attachments ? options.attachments.length : 0
      };
      
      // Mettre à jour le titre si c'est une nouvelle conversation
      if (!conversation.title && conversation.participants.length === 2) {
        const otherParticipantId = conversation.participants.find(
          p => p.toString() !== senderId.toString()
        );
        if (otherParticipantId) {
          const otherUser = await User.findById(otherParticipantId).select('nom prenum');
          if (otherUser) {
            const sender = await User.findById(senderId).select('nom prenum');
            conversation.title = `${sender.prenum} ${sender.nom} - ${otherUser.prenum} ${otherUser.nom}`;
          }
        }
      }
      
      // Incrémenter les compteurs de messages non lus pour tous les participants sauf l'expéditeur
      const otherParticipants = conversation.participants.filter(
        p => p.toString() !== senderId.toString()
      );
      
      otherParticipants.forEach(participantId => {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      });
      
      await conversation.save();
      
      // Populer les informations de l'expéditeur
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'nom prenum email role avatar')
        .populate('mentions', 'nom prenum email avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender createdAt',
          populate: {
            path: 'sender',
            select: 'nom prenum avatar'
          }
        })
        .lean();
      
      // ⭐ NOTIFICATION : Nouveau message
      await NotificationService.notifyNewMessage(message._id, senderId);
      
      // ⭐ NOTIFICATION : Mentions
      if (options.mentions && options.mentions.length > 0) {
        const sender = await User.findById(senderId).select('nom prenum');
        for (const mentionedId of options.mentions) {
          await NotificationService.notifyMention(
            message._id,
            mentionedId,
            `${sender.prenum} ${sender.nom}`
          );
        }
      }
      
      console.log(`✅ Message envoyé: ${message._id} dans conversation: ${conversationId}`);
      
      return populatedMessage;
      
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer les messages d'une conversation
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur
   * @param {Object} filters - Filtres de recherche
   * @returns {Array} Messages
   */
  async getConversationMessages(conversationId, userId, filters = {}) {
    try {
      // Vérifier l'accès
      const hasAccess = await Conversation.exists({
        _id: conversationId,
        participants: userId
      });
      
      if (!hasAccess) {
        throw new Error('Accès refusé à cette conversation');
      }
      
      const { 
        limit = 50, 
        before = null, 
        after = null,
        includeDeleted = false 
      } = filters;
      
      let query = { conversationId };
      
      // Filtrer par date
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      } else if (after) {
        query.createdAt = { $gt: new Date(after) };
      }
      
      // Exclure les messages supprimés par l'utilisateur
      if (!includeDeleted) {
        query['deletedBy.userId'] = { $ne: userId };
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('sender', 'nom prenum email role avatar')
        .populate('mentions', 'nom prenum avatar')
        .populate({
          path: 'replyTo',
          select: 'content sender createdAt',
          populate: {
            path: 'sender',
            select: 'nom prenum avatar'
          }
        })
        .lean();
      
      // Marquer comme lu
      await this.markConversationAsRead(conversationId, userId);
      
      // Retourner du plus ancien au plus récent
      return messages.reverse();
      
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      throw error;
    }
  }
  
  /**
   * Marquer une conversation comme lue
   * @param {String} conversationId - ID de la conversation
   * @param {String} userId - ID de l'utilisateur
   */
  async markConversationAsRead(conversationId, userId) {
    try {
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation || !conversation.participants.includes(userId)) {
        return;
      }
      
      // Réinitialiser le compteur de messages non lus
      const hadUnread = conversation.unreadCount?.get(userId.toString()) || 0;
      
      if (hadUnread > 0) {
        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();
        
        // Marquer tous les messages non lus comme lus
        const unreadMessages = await Message.find({
          conversationId,
          'readBy.userId': { $ne: userId },
          sender: { $ne: userId }
        }).limit(50);
        
        for (const message of unreadMessages) {
          await this.markMessageAsRead(message._id, userId);
        }
      }
      
      console.log(`✅ Conversation ${conversationId} marquée comme lue par ${userId}`);
      
    } catch (error) {
      console.error('❌ Erreur marquer conversation comme lue:', error);
      throw error;
    }
  }
  
  /**
   * Marquer un message comme lu
   * @param {String} messageId - ID du message
   * @param {String} userId - ID de l'utilisateur
   * @returns {Object} Message mis à jour
   */
  async markMessageAsRead(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message non trouvé');
      }
      
      // Vérifier que l'utilisateur fait partie de la conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        participants: userId
      });
      
      if (!conversation) {
        throw new Error('Accès refusé');
      }
      
      // Marquer comme lu si pas déjà fait
      const alreadyRead = message.readBy.some(reader => 
        reader.userId.toString() === userId.toString()
      );
      
      if (!alreadyRead) {
        message.readBy.push({ userId, readAt: new Date() });
        await message.save();
        
        // Décrémenter le compteur de messages non lus
        const currentCount = conversation.unreadCount.get(userId.toString()) || 0;
        if (currentCount > 0) {
          conversation.unreadCount.set(userId.toString(), currentCount - 1);
          await conversation.save();
        }
        
        // ⭐ NOTIFICATION : Message lu
        await NotificationService.notifyMessageRead(messageId, userId);
      }
      
      return message;
      
    } catch (error) {
      console.error('❌ Erreur marquer message comme lu:', error);
      throw error;
    }
  }
  
  /**
   * Éditer un message
   * @param {String} messageId - ID du message
   * @param {String} userId - ID de l'utilisateur
   * @param {String} newContent - Nouveau contenu
   * @returns {Object} Message édité
   */
  async editMessage(messageId, userId, newContent) {
    try {
      const message = await Message.findOne({
        _id: messageId,
        sender: userId
      });
      
      if (!message) {
        throw new Error('Message non trouvé ou non autorisé');
      }
      
      // Limite de temps pour l'édition (30 minutes)
      const timeLimit = 30 * 60 * 1000;
      const timeSinceCreation = Date.now() - message.createdAt.getTime();
      
      if (timeSinceCreation > timeLimit) {
        throw new Error('Le délai d\'édition est dépassé (30 minutes)');
      }
      
      // Sauvegarder l'ancien contenu
      message.edited = {
        isEdited: true,
        editedAt: new Date(),
        previousContent: message.content
      };
      
      message.content = newContent.trim();
      await message.save();
      
      return message;
      
    } catch (error) {
      console.error('❌ Erreur édition message:', error);
      throw error;
    }
  }
  
  /**
   * Supprimer un message
   * @param {String} messageId - ID du message
   * @param {String} userId - ID de l'utilisateur
   * @returns {Object} Message supprimé
   */
  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new Error('Message non trouvé');
      }
      
      // Vérifier les permissions (expéditeur ou admin)
      const isSender = message.sender.toString() === userId.toString();
      
      if (!isSender) {
        const user = await User.findById(userId);
        const isAdmin = user && ['admin', 'dga'].includes(user.role);
        
        if (!isAdmin) {
          throw new Error('Non autorisé à supprimer ce message');
        }
      }
      
      // Marquer comme supprimé plutôt que suppression physique
      message.deletedBy.push({ userId, deletedAt: new Date() });
      
      // Garder une trace du contenu original pour les admins
      if (!isSender) {
        message.metadata = message.metadata || {};
        message.metadata.deletedByAdmin = {
          adminId: userId,
          originalContent: message.content,
          deletedAt: new Date()
        };
      }
      
      message.content = '[Message supprimé]';
      await message.save();
      
      return message;
      
    } catch (error) {
      console.error('❌ Erreur suppression message:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer les informations de lecture d'un message
   * @param {String} messageId - ID du message
   * @param {String} userId - ID de l'utilisateur (pour vérifier l'accès)
   * @returns {Object} Informations de lecture
   */
  async getMessageReadInfo(messageId, userId) {
    try {
      const message = await Message.findById(messageId)
        .populate('readBy.userId', 'nom prenum avatar')
        .populate('conversationId', 'participants');
      
      if (!message) {
        throw new Error('Message non trouvé');
      }
      
      // Vérifier l'accès
      const hasAccess = await Conversation.exists({
        _id: message.conversationId,
        participants: userId
      });
      
      if (!hasAccess) {
        throw new Error('Accès refusé');
      }
      
      // Récupérer les participants de la conversation
      const conversation = await Conversation.findById(message.conversationId)
        .populate('participants', 'nom prenum avatar');
      
      // Identifier qui a lu et qui n'a pas lu
      const readBy = message.readBy.map(r => ({
        userId: r.userId._id,
        userName: `${r.userId.prenum} ${r.userId.nom}`,
        readAt: r.readAt,
        avatar: r.userId.avatar
      }));
      
      const readUserIds = readBy.map(r => r.userId.toString());
      
      const unreadBy = conversation.participants
        .filter(p => 
          p._id.toString() !== message.sender.toString() && 
          !readUserIds.includes(p._id.toString())
        )
        .map(p => ({
          userId: p._id,
          userName: `${p.prenum} ${p.nom}`,
          avatar: p.avatar
        }));
      
      return {
        messageId,
        totalParticipants: conversation.participants.length - 1, // Exclure l'expéditeur
        readBy,
        unreadBy,
        readCount: readBy.length,
        unreadCount: unreadBy.length
      };
      
    } catch (error) {
      console.error('❌ Erreur récupération infos lecture:', error);
      throw error;
    }
  }
  
  // ==================== MESSAGES SYSTÈME ====================
  
  /**
   * Ajouter un message système
   */
  async addSystemMessage(conversationId, type, data, senderId = null) {
    try {
      const systemMessages = {
        conversation_created: `✅ Conversation créée`,
        conversation_started: `💬 Conversation démarrée`,
        demande_attached: `📋 Demande #${data.demandeReference || ''} attachée à la conversation`,
        user_joined: `👤 ${data.userName || 'Un utilisateur'} a rejoint la conversation`,
        user_left: `👋 ${data.userName || 'Un utilisateur'} a quitté la conversation`,
        user_mentioned: `@ ${data.mentionedUserName || 'Un utilisateur'} a été mentionné`,
        conversation_archived: `📁 Conversation archivée`,
        conversation_unarchived: `📂 Conversation désarchivée`
      };
      
      // Si senderId n'est pas fourni, utiliser le premier participant
      if (!senderId) {
        const conversation = await Conversation.findById(conversationId);
        senderId = conversation?.participants[0] || null;
      }
      
      const message = await Message.create({
        conversationId,
        sender: senderId,
        content: systemMessages[type] || 'Notification système',
        type: 'system',
        metadata: {
          systemType: type,
          ...data,
          isSystemMessage: true
        }
      });
      
      console.log(`✅ Message système ajouté: ${type} dans conversation ${conversationId}`);
      
      return message;
      
    } catch (error) {
      console.error('❌ Erreur message système:', error);
      throw error;
    }
  }
  
  /**
   * Mentionner un utilisateur dans un message
   */
  async mentionUser(conversationId, senderId, mentionedUserId, messageContent) {
    try {
      // Vérifier que l'utilisateur mentionné fait partie de la conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: { $all: [senderId, mentionedUserId] }
      });
      
      if (!conversation) {
        throw new Error('L\'utilisateur mentionné ne fait pas partie de la conversation');
      }
      
      const mentionedUser = await User.findById(mentionedUserId);
      const sender = await User.findById(senderId);
      
      if (!mentionedUser || !sender) {
        throw new Error('Utilisateur non trouvé');
      }
      
      // Créer le message avec mention
      const message = await this.sendMessage(conversationId, senderId, messageContent, {
        metadata: {
          mentions: [mentionedUserId],
          mentionType: 'user'
        },
        mentions: [mentionedUserId]
      });
      
      return message;
      
    } catch (error) {
      console.error('❌ Erreur mention utilisateur:', error);
      throw error;
    }
  }
  
  // ==================== STATISTIQUES ====================
  
  /**
   * Obtenir les statistiques de chat
   */
  async getChatStats(userId, filters = {}) {
    try {
      const { periode = '30d' } = filters;
      
      const endDate = new Date();
      let startDate = new Date();
      
      switch (periode) {
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }
      
      // Conversations de l'utilisateur
      const userConversations = await Conversation.find({
        participants: userId,
        createdAt: { $gte: startDate }
      });
      
      const conversationIds = userConversations.map(c => c._id);
      
      // Messages envoyés par l'utilisateur
      const messagesSent = await Message.countDocuments({
        sender: userId,
        createdAt: { $gte: startDate },
        type: { $ne: 'system' }
      });
      
      // Messages reçus par l'utilisateur
      const messagesReceived = await Message.countDocuments({
        conversationId: { $in: conversationIds },
        sender: { $ne: userId },
        type: { $ne: 'system' },
        createdAt: { $gte: startDate }
      });
      
      // Messages système
      const systemMessages = await Message.countDocuments({
        conversationId: { $in: conversationIds },
        type: 'system',
        createdAt: { $gte: startDate }
      });
      
      // Messages non lus
      let totalUnread = 0;
      for (const conv of userConversations) {
        totalUnread += conv.unreadCount?.get(userId.toString()) || 0;
      }
      
      // Activité par jour
      const dailyActivity = await Message.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            createdAt: { $gte: startDate },
            type: { $ne: 'system' }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            sent: {
              $sum: { $cond: [{ $eq: ["$sender", userId] }, 1, 0] }
            },
            received: {
              $sum: { $cond: [{ $ne: ["$sender", userId] }, 1, 0] }
            },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Conversations les plus actives
      const mostActiveConversations = await Message.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            createdAt: { $gte: startDate },
            type: { $ne: 'system' }
          }
        },
        {
          $group: {
            _id: "$conversationId",
            messageCount: { $sum: 1 },
            lastMessage: { $max: "$createdAt" }
          }
        },
        { $sort: { messageCount: -1 } },
        { $limit: 5 }
      ]);
      
      // Récupérer les détails des conversations
      for (const conv of mostActiveConversations) {
        const conversation = await Conversation.findById(conv._id)
          .populate({
            path: 'participants',
            select: 'nom prenum avatar',
            match: { _id: { $ne: userId } }
          })
          .select('title demandeId')
          .lean();
        
        if (conversation) {
          conv.details = conversation;
        }
      }
      
      return {
        periode,
        dateRange: { startDate, endDate },
        conversations: {
          total: userConversations.length,
          active: userConversations.filter(c => 
            c.lastMessage && 
            Date.now() - c.lastMessage.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000
          ).length,
          archived: userConversations.filter(c => c.isArchived).length
        },
        messages: {
          sent: messagesSent,
          received: messagesReceived,
          system: systemMessages,
          total: messagesSent + messagesReceived + systemMessages,
          unread: totalUnread
        },
        dailyActivity,
        mostActiveConversations,
        averageResponseTime: await this.calculateAverageResponseTime(userId, startDate)
      };
      
    } catch (error) {
      console.error('❌ Erreur stats chat:', error);
      throw error;
    }
  }
  
  /**
   * Calculer le temps de réponse moyen
   */
  async calculateAverageResponseTime(userId, startDate) {
    try {
      const conversations = await Conversation.find({
        participants: userId,
        type: 'support'
      });
      
      if (conversations.length === 0) return null;
      
      const conversationIds = conversations.map(c => c._id);
      
      // Récupérer tous les messages dans l'ordre chronologique
      const allMessages = await Message.find({
        conversationId: { $in: conversationIds },
        createdAt: { $gte: startDate },
        type: { $ne: 'system' }
      }).sort({ conversationId: 1, createdAt: 1 });
      
      // Grouper par conversation
      const messagesByConversation = {};
      allMessages.forEach(msg => {
        if (!messagesByConversation[msg.conversationId]) {
          messagesByConversation[msg.conversationId] = [];
        }
        messagesByConversation[msg.conversationId].push(msg);
      });
      
      let totalResponseTime = 0;
      let responseCount = 0;
      
      // Analyser chaque conversation
      Object.values(messagesByConversation).forEach(messages => {
        for (let i = 1; i < messages.length; i++) {
          const prevMessage = messages[i - 1];
          const currentMessage = messages[i];
          
          // Si les messages sont de personnes différentes
          if (prevMessage.sender.toString() !== currentMessage.sender.toString()) {
            const responseTime = currentMessage.createdAt - prevMessage.createdAt;
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
      });
      
      return responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null;
      
    } catch (error) {
      console.error('❌ Erreur calcul temps réponse:', error);
      return null;
    }
  }
  
  // ==================== RECHERCHE ====================
  
  /**
   * Rechercher dans les messages
   */
  async searchMessages(userId, query, filters = {}) {
    try {
      const { limit = 20, page = 1, conversationId } = filters;
      const skip = (page - 1) * limit;
      
      // Déterminer les conversations accessibles
      let conversationIds;
      if (conversationId) {
        // Vérifier l'accès à la conversation spécifique
        const hasAccess = await Conversation.exists({
          _id: conversationId,
          participants: userId
        });
        
        if (!hasAccess) {
          throw new Error('Accès refusé à cette conversation');
        }
        conversationIds = [conversationId];
      } else {
        // Toutes les conversations de l'utilisateur
        const userConversations = await Conversation.find({
          participants: userId
        }).select('_id');
        conversationIds = userConversations.map(c => c._id);
      }
      
      const searchQuery = {
        conversationId: { $in: conversationIds },
        content: { $regex: query, $options: 'i' },
        'deletedBy.userId': { $ne: userId }
      };
      
      const messages = await Message.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'nom prenum avatar')
        .populate({
          path: 'conversationId',
          select: 'title participants demandeId',
          populate: {
            path: 'participants',
            select: 'nom prenum avatar',
            match: { _id: { $ne: userId } }
          }
        })
        .lean();
      
      const total = await Message.countDocuments(searchQuery);
      
      // Enrichir les résultats avec les informations de contexte
      const enrichedMessages = await Promise.all(
        messages.map(async (message) => {
          // Récupérer quelques messages avant/après pour le contexte
          const contextMessages = await Message.find({
            conversationId: message.conversationId._id,
            createdAt: {
              $gt: new Date(message.createdAt.getTime() - 5 * 60 * 1000),
              $lt: new Date(message.createdAt.getTime() + 5 * 60 * 1000)
            }
          })
          .sort({ createdAt: 1 })
          .limit(5)
          .populate('sender', 'nom prenum avatar')
          .lean();
          
          return {
            ...message,
            context: contextMessages
          };
        })
      );
      
      return {
        messages: enrichedMessages,
        query,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur recherche messages:', error);
      throw error;
    }
  }
  
  /**
   * Rechercher dans les conversations
   */
  async searchConversations(userId, query, filters = {}) {
    try {
      const { limit = 20, page = 1 } = filters;
      const skip = (page - 1) * limit;
      
      // Rechercher dans les titres de conversation
      const titleResults = await Conversation.find({
        participants: userId,
        title: { $regex: query, $options: 'i' }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'participants',
        select: 'nom prenum avatar',
        match: { _id: { $ne: userId } }
      })
      .populate('demandeId', 'numeroReference')
      .lean();
      
      // Rechercher dans les noms des participants
      const users = await User.find({
        $or: [
          { nom: { $regex: query, $options: 'i' } },
          { prenum: { $regex: query, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      
      const participantResults = await Conversation.find({
        participants: { $all: [userId, ...userIds] }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'participants',
        select: 'nom prenum avatar',
        match: { _id: { $ne: userId } }
      })
      .populate('demandeId', 'numeroReference')
      .lean();
      
      // Fusionner et dédupliquer les résultats
      const allResultsMap = new Map();
      
      [...titleResults, ...participantResults].forEach(conv => {
        allResultsMap.set(conv._id.toString(), conv);
      });
      
      const results = Array.from(allResultsMap.values());
      
      return {
        conversations: results,
        query,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: results.length,
          pages: Math.ceil(results.length / limit)
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur recherche conversations:', error);
      throw error;
    }
  }
  
  // ==================== UTILITAIRES ====================
  
  /**
   * Générer un titre de conversation
   */
  generateConversationTitle(participantIds, users) {
    if (users.length === 2) {
      return `${users[0].prenum} ${users[0].nom} - ${users[1].prenum} ${users[1].nom}`;
    } else if (users.length > 2) {
      const firstTwo = users.slice(0, 2);
      return `Groupe: ${firstTwo.map(u => u.prenum).join(', ')} + ${users.length - 2}`;
    }
    return 'Nouvelle conversation';
  }
  
  /**
   * Déterminer le type de fichier
   */
  getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    const types = {
      // Images
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image', svg: 'image',
      // Documents
      pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
      ppt: 'document', pptx: 'document', txt: 'document', rtf: 'document',
      // Archives
      zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
      // Vidéos
      mp4: 'video', avi: 'video', mov: 'video', wmv: 'video', mkv: 'video',
      // Audio
      mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio',
      // Autres
      exe: 'executable', dmg: 'disk', iso: 'disk'
    };
    
    return types[extension] || 'file';
  }
  
  /**
   * Vérifier si un utilisateur peut envoyer un message
   */
  async canSendMessage(conversationId, userId) {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
        isArchived: false
      });
      
      return !!conversation;
      
    } catch (error) {
      console.error('❌ Erreur vérification permissions:', error);
      return false;
    }
  }
  
  /**
   * Nettoyer les conversations orphelines
   */
  async cleanupOrphanedConversations() {
    try {
      // Trouver les conversations sans messages depuis plus de 30 jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const orphanedConversations = await Conversation.aggregate([
        {
          $lookup: {
            from: 'messages',
            localField: '_id',
            foreignField: 'conversationId',
            as: 'messages'
          }
        },
        {
          $match: {
            $or: [
              { messages: { $size: 0 } },
              { 
                'lastMessage.createdAt': { $lt: thirtyDaysAgo },
                isArchived: false 
              }
            ]
          }
        }
      ]);
      
      const archivedIds = [];
      
      for (const conv of orphanedConversations) {
        await Conversation.findByIdAndUpdate(conv._id, {
          isArchived: true,
          $push: {
            archivedBy: {
              userId: null,
              archivedAt: new Date(),
              reason: 'auto_cleanup'
            }
          }
        });
        
        archivedIds.push(conv._id);
      }
      
      return {
        archivedCount: archivedIds.length,
        archivedIds
      };
      
    } catch (error) {
      console.error('❌ Erreur nettoyage conversations:', error);
      throw error;
    }
  }
  
  /**
   * Obtenir le nombre total de messages non lus
   */
  async getTotalUnreadCount(userId) {
    try {
      const conversations = await Conversation.find({
        participants: userId,
        isArchived: false
      });
      
      let totalUnread = 0;
      for (const conv of conversations) {
        totalUnread += conv.unreadCount?.get(userId.toString()) || 0;
      }
      
      return totalUnread;
      
    } catch (error) {
      console.error('❌ Erreur comptage messages non lus:', error);
      return 0;
    }
  }
}

module.exports = new ChatService();