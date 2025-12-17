// src/services/notification.service.js
const Notification = require('../models/Notification');
const NotificationTemplate = require('../models/NotificationTemplate');

class NotificationService {
  
  /**
   * Créer une notification directe (sans template)
   */
  static async create(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      console.log(`✅ Notification créée: ${notification.titre}`);
      
      // TODO: Émettre via WebSocket
      // this.emitToUser(notification.utilisateur, notification);
      
      return notification;
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      throw error;
    }
  }
  
  /**
   * ✅ NOUVEAU : Créer une notification depuis un template
   */
  static async createFromTemplate(templateCode, userId, variables = {}, options = {}) {
    try {
      // Récupérer le template
      const template = await NotificationTemplate.findOne({ 
        code: templateCode.toUpperCase(), 
        actif: true 
      });
      
      if (!template) {
        throw new Error(`Template ${templateCode} introuvable`);
      }
      
      // Remplacer les variables dans le titre et le message
      const titre = this.replaceVariables(template.titreTemplate, variables);
      const message = this.replaceVariables(template.messageTemplate, variables);
      
      // Créer la notification
      const notificationData = {
        utilisateur: userId,
        type: template.type,
        titre,
        message,
        priorite: template.priorite,
        templateCode: template.code,
        entite: options.entite || null,
        entiteId: options.entiteId || null,
        lien: options.lien || null,
        metadata: {
          ...options.metadata,
          templateCode: template.code,
          variables
        }
      };
      
      return await this.create(notificationData);
    } catch (error) {
      console.error('❌ Erreur création notification depuis template:', error);
      throw error;
    }
  }
  
  /**
   * ✅ NOUVEAU : Créer des notifications pour plusieurs utilisateurs
   */
  static async createBulkFromTemplate(templateCode, userIds, variables = {}, options = {}) {
    const notifications = [];
    
    for (const userId of userIds) {
      try {
        const notification = await this.createFromTemplate(
          templateCode, 
          userId, 
          variables, 
          options
        );
        notifications.push(notification);
      } catch (error) {
        console.error(`❌ Erreur pour user ${userId}:`, error.message);
      }
    }
    
    return notifications;
  }
  
  /**
   * ✅ NOUVEAU : Remplacer les variables {{variable}} dans un texte
   */
  static replaceVariables(texte, variables) {
    let resultat = texte;
    
    for (const [cle, valeur] of Object.entries(variables)) {
      const regex = new RegExp(`{{${cle}}}`, 'g');
      resultat = resultat.replace(regex, valeur || '');
    }
    
    return resultat;
  }
  
  /**
   * Récupérer les notifications d'un utilisateur
   */
  static async getUserNotifications(userId, options = {}) {
    const { 
      limit = 20, 
      page = 1,
      unreadOnly = false,
      priorite = null,
      type = null
    } = options;
    
    const query = { utilisateur: userId };
    if (unreadOnly) query.lue = false;
    if (priorite) query.priorite = priorite;
    if (type) query.type = type;
    
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find(query)
      .sort({ priorite: -1, createdAt: -1 }) // Priorité d'abord
      .skip(skip)
      .limit(limit);
    
    const total = await Notification.countDocuments(query);
    const unread = await Notification.countDocuments({ 
      utilisateur: userId, 
      lue: false 
    });
    
    return {
      notifications,
      pagination: {
        total,
        unread,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Marquer comme lue
   */
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, utilisateur: userId },
      { 
        lue: true,
        lueAt: new Date()
      },
      { new: true }
    );
    
    return notification;
  }
  
  /**
   * ✅ NOUVEAU : Marquer toutes comme lues
   */
  static async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { utilisateur: userId, lue: false },
      { 
        lue: true,
        lueAt: new Date()
      }
    );
    
    return result;
  }
  
  /**
   * ✅ NOUVEAU : Supprimer une notification
   */
  static async deleteNotification(notificationId, userId) {
    return await Notification.findOneAndDelete({
      _id: notificationId,
      utilisateur: userId
    });
  }
  
  /**
   * ✅ NOUVEAU : Compter les non lues
   */
  static async getUnreadCount(userId) {
    return await Notification.countDocuments({
      utilisateur: userId,
      lue: false
    });
  }
}

module.exports = NotificationService;