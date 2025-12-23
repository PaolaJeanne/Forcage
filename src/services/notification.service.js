const Notification = require('../models/Notification');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

class NotificationService {

  // ==================== MÉTHODES GÉNÉRIQUES ====================

  /**
   * Créer une notification (méthode universelle)
   */
  async createNotification(options) {
    try {
      const {
        utilisateur,
        titre,
        message,
        entite = 'other',
        entiteId = null,
        type = 'info',
        priorite = 'normale',
        categorie = 'other',
        action = 'view',
        lien = null,
        metadata = {},
        source = 'system',
        declencheur = null,
        tags = []
      } = options;

      // Validation
      if (!utilisateur || !titre || !message) {
        throw new Error('Paramètres requis manquants');
      }

      // Vérifier l'utilisateur
      const userExists = await User.exists({ _id: utilisateur });
      if (!userExists) {
        throw new Error('Utilisateur non trouvé');
      }

      // Date d'expiration (30 jours par défaut)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Créer la notification
      const notification = await Notification.create({
        utilisateur,
        titre: titre.trim(),
        message: message.trim(),
        entite,
        entiteId,
        type,
        priorite,
        categorie,
        action,
        lien,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          source
        },
        source,
        declencheur,
        tags: [...new Set([...tags, entite, categorie])],
        expiresAt,
        lue: false,
        lueAt: null
      });

      // Envoyer en temps réel
      await this.sendRealTimeNotification(notification);



      return this.formatNotification(notification);

    } catch (error) {

      throw error;
    }
  }

  /**
   * Formater une notification pour l'API
   */
  formatNotification(notification) {
    const notif = notification.toObject ? notification.toObject() : notification;

    // Ajouter le lien complet
    const baseUrl = process.env.FRONTEND_URL || '';
    if (notif.lien && !notif.lien.startsWith('http')) {
      notif.lienComplet = `${baseUrl}${notif.lien}`;
    } else {
      notif.lienComplet = notif.lien;
    }

    // Calculer le temps écoulé
    const now = new Date();
    const createdAt = new Date(notif.createdAt);
    const diffMs = now - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) notif.tempsEcoule = 'À l\'instant';
    else if (diffMins < 60) notif.tempsEcoule = `Il y a ${diffMins} min`;
    else if (diffHours < 24) notif.tempsEcoule = `Il y a ${diffHours} h`;
    else if (diffDays < 7) notif.tempsEcoule = `Il y a ${diffDays} j`;
    else notif.tempsEcoule = createdAt.toLocaleDateString('fr-FR');

    // Vérifier expiration
    notif.estExpiree = notif.expiresAt && new Date() > new Date(notif.expiresAt);

    return notif;
  }

  // ==================== NOTIFICATIONS CHAT ====================

  /**
   * Notifier nouveau message
   */
  async notifyNewMessage(messageId, excludeSenderId = null) {
    try {
      const message = await Message.findById(messageId)
        .populate('sender', 'nom prenum')
        .populate('conversationId', 'title participants');

      if (!message || !message.conversationId) return;

      const conversation = await Conversation.findById(message.conversationId._id)
        .populate('participants', 'nom prenum email');

      const recipients = conversation.participants.filter(
        participant => participant._id.toString() !== excludeSenderId?.toString()
      );

      const notifications = [];

      for (const recipient of recipients) {
        const notification = await this.createNotification({
          utilisateur: recipient._id,
          titre: `💬 ${message.sender.prenum} ${message.sender.nom}`,
          message: message.content.length > 100
            ? `${message.content.substring(0, 100)}...`
            : message.content,
          entite: 'message',
          entiteId: message._id,
          type: 'info',
          priorite: 'normale',
          categorie: 'chat',
          action: 'view',
          lien: `/chat/conversations/${conversation._id}`,
          metadata: {
            messageId: message._id,
            conversationId: conversation._id,
            senderId: message.sender._id,
            senderName: `${message.sender.prenum} ${message.sender.nom}`,
            conversationTitle: conversation.title,
            type: 'NEW_MESSAGE'
          },
          source: 'user',
          declencheur: message.sender._id,
          tags: ['chat', 'message', 'new']
        });

        notifications.push(notification);
      }

      return notifications;

    } catch (error) {

    }
  }

  /**
   * Notifier message lu
   */
  async notifyMessageRead(messageId, readerId) {
    try {
      const message = await Message.findById(messageId)
        .populate('sender', 'nom prenum')
        .populate('conversationId', 'title');

      const reader = await User.findById(readerId).select('nom prenum');

      if (!message || !reader || !message.sender) return;

      // Ne pas notifier si c'est l'expéditeur qui lit
      if (message.sender._id.toString() === readerId.toString()) return;

      return await this.createNotification({
        utilisateur: message.sender._id,
        titre: `👁️ ${reader.prenum} ${reader.nom}`,
        message: `a lu votre message "${message.content.substring(0, 50)}..."`,
        entite: 'message',
        entiteId: message._id,
        type: 'info',
        priorite: 'normale',
        categorie: 'chat',
        action: 'view',
        lien: `/chat/conversations/${message.conversationId?._id}`,
        metadata: {
          messageId: message._id,
          readerId: reader._id,
          readerName: `${reader.prenum} ${reader.nom}`,
          readAt: new Date(),
          type: 'MESSAGE_READ'
        },
        source: 'system',
        declencheur: reader._id,
        tags: ['chat', 'message', 'read']
      });

    } catch (error) {

    }
  }

  /**
   * Notifier mention
   */
  async notifyMention(messageId, mentionedUserId, mentionedByName) {
    try {
      const message = await Message.findById(messageId)
        .populate('conversationId', 'title');

      if (!message) return;

      return await this.createNotification({
        utilisateur: mentionedUserId,
        titre: `@ ${mentionedByName} vous a mentionné`,
        message: `Dans "${message.conversationId?.title || 'une conversation'}"`,
        entite: 'message',
        entiteId: message._id,
        type: 'urgent',
        priorite: 'haute',
        categorie: 'chat',
        action: 'view',
        lien: `/chat/conversations/${message.conversationId?._id}`,
        metadata: {
          messageId: message._id,
          conversationId: message.conversationId?._id,
          mentionedByName,
          mentionText: message.content.substring(0, 100),
          type: 'MENTION'
        },
        source: 'user',
        declencheur: null,
        tags: ['chat', 'mention', 'urgent']
      });

    } catch (error) {

    }
  }

  /**
   * Notifier nouvelle conversation
   */
  async notifyNewConversation(conversationId, createdByUserId) {
    try {
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'nom prenum email');

      const createdBy = await User.findById(createdByUserId).select('nom prenum');

      if (!conversation || !createdBy) return;

      const otherParticipants = conversation.participants.filter(
        p => p._id.toString() !== createdByUserId.toString()
      );

      const notifications = [];

      for (const participant of otherParticipants) {
        const notification = await this.createNotification({
          utilisateur: participant._id,
          titre: `💬 Nouvelle conversation`,
          message: `${createdBy.prenum} ${createdBy.nom} a démarré une conversation`,
          entite: 'conversation',
          entiteId: conversation._id,
          type: 'info',
          priorite: 'normale',
          categorie: 'chat',
          action: 'view',
          lien: `/chat/conversations/${conversation._id}`,
          metadata: {
            conversationId: conversation._id,
            createdBy: createdByUserId,
            createdByName: `${createdBy.prenum} ${createdBy.nom}`,
            type: 'NEW_CONVERSATION'
          },
          source: 'user',
          declencheur: createdByUserId,
          tags: ['chat', 'conversation', 'new']
        });

        notifications.push(notification);
      }

      return notifications;

    } catch (error) {

    }
  }

  // ==================== NOTIFICATIONS DEMANDES ====================

  /**
   * Notifier création de demande
   */
  async notifyDemandeCreated(demande) {
    try {
      const destinataires = [
        demande.clientId,
        demande.conseillerId,
        ...(demande.autresParticipants || [])
      ].filter(Boolean);

      const notifications = [];

      for (const destinataireId of destinataires) {
        const notification = await this.createNotification({
          utilisateur: destinataireId,
          titre: `📋 Demande #${demande.numeroReference} créée`,
          message: `Demande de ${demande.typeOperation} pour ${demande.montant} FCFA`,
          entite: 'demande',
          entiteId: demande._id,
          type: 'success',
          priorite: 'normale',
          categorie: 'demande',
          action: 'view',
          lien: `/demandes/${demande._id}`,
          metadata: {
            demandeId: demande._id,
            numeroReference: demande.numeroReference,
            typeOperation: demande.typeOperation,
            montant: demande.montant,
            statut: demande.statut,
            type: 'DEMANDE_CREATED'
          },
          source: 'system',
          declencheur: demande.createdBy,
          tags: ['demande', 'created', demande.typeOperation]
        });

        notifications.push(notification);
      }

      return notifications;

    } catch (error) {

    }
  }

  /**
   * Notifier changement de statut de demande
   */
  async notifyDemandeStatusChanged(demande, previousStatus, changedBy) {
    try {
      const destinataires = [
        demande.clientId,
        demande.conseillerId
      ].filter(Boolean);

      const statutMessages = {
        'validée': 'a été validée ✅',
        'rejetée': 'a été rejetée ❌',
        'en_cours': 'est en cours de traitement 🔄',
        'terminee': 'a été terminée 🏁'
      };

      const notifications = [];

      for (const destinataireId of destinataires) {
        const notification = await this.createNotification({
          utilisateur: destinataireId,
          titre: `📋 Demande #${demande.numeroReference} - ${demande.statut}`,
          message: `Votre demande ${statutMessages[demande.statut] || 'a changé de statut'}`,
          entite: 'demande',
          entiteId: demande._id,
          type: demande.statut === 'rejetée' ? 'error' :
            demande.statut === 'validée' ? 'success' : 'info',
          priorite: 'normale',
          categorie: 'demande',
          action: 'view',
          lien: `/demandes/${demande._id}`,
          metadata: {
            demandeId: demande._id,
            numeroReference: demande.numeroReference,
            previousStatus,
            newStatus: demande.statut,
            changedBy,
            type: 'DEMANDE_STATUS_CHANGED'
          },
          source: 'system',
          declencheur: changedBy,
          tags: ['demande', 'status', demande.statut]
        });

        notifications.push(notification);
      }

      return notifications;

    } catch (error) {

    }
  }

  // ==================== NOTIFICATIONS SYSTÈME ====================

  /**
   * Notifier système (maintenance, alertes, etc.)
   */
  async notifySystem(options) {
    try {
      const {
        titre,
        message,
        destinataireIds = 'all', // 'all' ou array d'IDs
        type = 'system',
        priorite = 'normale',
        lien = null,
        metadata = {}
      } = options;

      let notifications = [];

      if (destinataireIds === 'all') {
        // Tous les utilisateurs actifs
        const users = await User.find({ actif: true }).select('_id');
        const userIds = users.map(user => user._id);

        for (const userId of userIds) {
          const notification = await this.createNotification({
            utilisateur: userId,
            titre,
            message,
            entite: 'systeme',
            entiteId: null,
            type,
            priorite,
            categorie: 'system',
            action: 'view',
            lien,
            metadata: {
              ...metadata,
              systemNotification: true,
              broadcast: true
            },
            source: 'system',
            declencheur: null,
            tags: ['system', 'broadcast', priorite]
          });

          notifications.push(notification);
        }
      } else {
        // Utilisateurs spécifiques
        for (const userId of Array.isArray(destinataireIds) ? destinataireIds : [destinataireIds]) {
          const notification = await this.createNotification({
            utilisateur: userId,
            titre,
            message,
            entite: 'systeme',
            entiteId: null,
            type,
            priorite,
            categorie: 'system',
            action: 'view',
            lien,
            metadata: {
              ...metadata,
              systemNotification: true
            },
            source: 'system',
            declencheur: null,
            tags: ['system', priorite]
          });

          notifications.push(notification);
        }
      }

      return notifications;

    } catch (error) {

    }
  }

  // ==================== GESTION DES NOTIFICATIONS ====================

  /**
   * Récupérer les notifications d'un utilisateur
   */
  async getUserNotifications(userId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        unreadOnly = false,
        entite = null,
        categorie = null,
        priorite = null
      } = filters;

      const skip = (page - 1) * limit;

      // Construire la query
      const query = { utilisateur: userId };

      if (unreadOnly === true || unreadOnly === 'true') {
        query.lue = false;
      }

      if (entite) query.entite = entite;
      if (categorie) query.categorie = categorie;
      if (priorite) query.priorite = priorite;

      // Exclure les expirées
      query.$or = [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ];

      // Récupérer
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('declencheur', 'nom prenum avatar')
        .lean();

      // Formater
      const formattedNotifications = notifications.map(notif =>
        this.formatNotification(notif)
      );

      // Compter
      const total = await Notification.countDocuments(query);

      // Compter les non lues par catégorie
      const unreadCounts = await Notification.aggregate([
        { $match: { utilisateur: userId, lue: false } },
        { $group: { _id: '$categorie', count: { $sum: 1 } } }
      ]);

      const unreadByCategory = {};
      unreadCounts.forEach(item => {
        unreadByCategory[item._id] = item.count;
      });

      return {
        notifications: formattedNotifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        unreadByCategory,
        totalUnread: Object.values(unreadByCategory).reduce((sum, count) => sum + count, 0)
      };

    } catch (error) {

      throw error;
    }
  }

  /**
   * Marquer comme lue
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, utilisateur: userId },
        { $set: { lue: true, lueAt: new Date() } },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification non trouvée ou non autorisée');
      }

      // Mettre à jour en temps réel
      if (global.io) {
        global.io.of('/notifications').to(`user_${userId}`).emit('notification_read', {
          notificationId,
          readAt: new Date()
        });
      }

      return this.formatNotification(notification);

    } catch (error) {

      throw error;
    }
  }

  /**
   * Marquer toutes comme lues
   */
  async markAllAsRead(userId, filters = {}) {
    try {
      const query = { utilisateur: userId, lue: false };

      if (filters.categorie) query.categorie = filters.categorie;
      if (filters.entite) query.entite = filters.entite;

      const result = await Notification.updateMany(
        query,
        { $set: { lue: true, lueAt: new Date() } }
      );

      // Mettre à jour en temps réel
      if (global.io) {
        global.io.of('/notifications').to(`user_${userId}`).emit('all_notifications_read', {
          count: result.modifiedCount,
          timestamp: new Date()
        });
      }

      return {
        success: true,
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} notifications marquées comme lues`
      };

    } catch (error) {

      throw error;
    }
  }

  /**
   * Supprimer une notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        utilisateur: userId
      });

      if (result.deletedCount === 0) {
        throw new Error('Notification non trouvée ou non autorisée');
      }

      return { success: true, message: 'Notification supprimée' };

    } catch (error) {

      throw error;
    }
  }

  /**
   * Nettoyer les notifications expirées
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() },
        priorite: { $ne: 'critique' }
      });


      return result;

    } catch (error) {

      throw error;
    }
  }

  // ==================== WEBSOCKET ====================

  /**
   * Envoyer en temps réel
   */
  async sendRealTimeNotification(notification) {
    try {
      if (!global.io) return;

      const formatted = this.formatNotification(notification);

      // Envoyer à l'utilisateur
      global.io.of('/notifications').to(`user_${notification.utilisateur}`).emit('new_notification', formatted);

      // Mettre à jour le compteur
      const unreadCount = await Notification.countDocuments({
        utilisateur: notification.utilisateur,
        lue: false
      });

      global.io.of('/notifications').to(`user_${notification.utilisateur}`).emit('unread_count_update', {
        count: unreadCount,
        timestamp: new Date()
      });

    } catch (error) {

    }
  }

  /**
   * Récupérer le compteur de notifications non lues
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        utilisateur: userId,
        lue: false,
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: null }
        ]
      });

    } catch (error) {

      return 0;
    }
  }
}

module.exports = new NotificationService();