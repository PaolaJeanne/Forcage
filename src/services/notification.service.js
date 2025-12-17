// src/services/notification.service.js
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

class NotificationService {
  
  /**
   * Créer une notification
   */
  static async create(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      
      // Log pour debug
      logger.info(`📢 Notification créée: ${notification.titre} pour ${notification.utilisateur}`);
      
      // Ici, vous pourriez ajouter:
      // - WebSocket pour notification en temps réel
      // - Email si notification importante
      // - SMS si urgence
      
      return notification;
    } catch (error) {
      logger.error('❌ Erreur création notification:', error);
      throw error;
    }
  }
  
  /**
   * Notifier la création d'une demande
   */
  static async notifyDemandeCreation(demande, createur) {
    // Notifier les conseillers de l'agence
    const User = require('../models/User');
    const conseillers = await User.find({
      role: 'conseiller',
      agence: createur.agence,
      isActive: true
    });
    
    const notifications = conseillers.map(conseiller => ({
      utilisateur: conseiller._id,
      type: 'demande_creation',
      titre: 'Nouvelle demande',
      message: `${createur.prenom} ${createur.nom} a créé une demande de ${demande.montant} FCFA`,
      entite: 'demande',
      entiteId: demande._id,
      lien: `/demandes/${demande._id}`,
      priorite: 'moyenne',
      metadata: {
        demandeId: demande._id,
        clientId: createur._id,
        montant: demande.montant,
        agence: createur.agence
      }
    }));
    
    await Notification.insertMany(notifications);
    logger.info(`📢 Notifications envoyées à ${conseillers.length} conseillers`);
  }
  
  /**
   * Notifier la validation d'une demande
   */
  static async notifyDemandeValidation(demande, validateur, niveau) {
    const notifications = [];
    
    // Notifier le client
    notifications.push({
      utilisateur: demande.clientId,
      type: 'demande_validation',
      titre: `Demande ${niveau === 'final' ? 'validée' : 'en cours'}`,
      message: `Votre demande de ${demande.montant} FCFA a été ${niveau === 'final' ? 'validée définitivement' : 'validée par ' + validateur.role}`,
      entite: 'demande',
      entiteId: demande._id,
      lien: `/demandes/${demande._id}`,
      priorite: 'haute',
      metadata: {
        validateur: validateur._id,
        niveau: niveau,
        statut: demande.statut
      }
    });
    
    // Si validation intermédiaire, notifier le niveau supérieur
    if (niveau === 'intermediaire') {
      const User = require('../models/User');
      const nextLevel = validateur.role === 'conseiller' ? 'rm' : 'dce';
      
      const responsables = await User.find({
        role: nextLevel,
        agence: validateur.agence,
        isActive: true
      });
      
      responsables.forEach(responsable => {
        notifications.push({
          utilisateur: responsable._id,
          type: 'demande_validation',
          titre: 'Demande à valider',
          message: `Une demande de ${demande.montant} FCFA nécessite votre validation`,
          entite: 'demande',
          entiteId: demande._id,
          lien: `/demandes/${demande._id}`,
          priorite: 'haute',
          metadata: {
            previousValidator: validateur._id,
            montant: demande.montant
          }
        });
      });
    }
    
    await Notification.insertMany(notifications);
  }
  
  /**
   * Notifier un événement d'audit important
   */
  static async notifyAuditEvent(auditLog, threshold = 10) {
    // Exemple: Notifier si trop d'échecs de connexion
    if (auditLog.action === 'tentative_connexion' && auditLog.details?.statusCode === 401) {
      const recentFailures = await Notification.countDocuments({
        'metadata.type': 'failed_login',
        'metadata.ip': auditLog.ipAddress,
        createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) } // 15 dernières minutes
      });
      
      if (recentFailures >= threshold) {
        // Notifier l'admin
        const User = require('../models/User');
        const admins = await User.find({ role: 'admin', isActive: true });
        
        admins.forEach(admin => {
          this.create({
            utilisateur: admin._id,
            type: 'audit_alert',
            titre: 'Alertes de sécurité',
            message: `${recentFailures} tentatives de connexion échouées depuis ${auditLog.ipAddress}`,
            entite: 'audit',
            entiteId: auditLog._id,
            priorite: 'urgente',
            metadata: {
              type: 'failed_login_brute_force',
              ip: auditLog.ipAddress,
              count: recentFailures,
              timestamp: new Date()
            }
          });
        });
      }
    }
  }
  
  /**
   * Récupérer les notifications d'un utilisateur
   */
  static async getUserNotifications(userId, options = {}) {
    const { limit = 20, page = 1, unreadOnly = false } = options;
    
    const query = { utilisateur: userId };
    if (unreadOnly) query.lue = false;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Notification.countDocuments(query);
    
    return {
      notifications,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }
  
  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      utilisateur: userId
    });
    
    if (!notification) {
      throw new Error('Notification non trouvée');
    }
    
    notification.lue = true;
    notification.lueAt = new Date();
    await notification.save();
    
    return notification;
  }
  
  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { utilisateur: userId, lue: false },
      { 
        lue: true,
        lueAt: new Date()
      }
    );
    
    return result.modifiedCount;
  }
  
  /**
   * Supprimer les anciennes notifications
   */
  static async cleanOldNotifications(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      lue: true,
      priorite: { $in: ['basse', 'moyenne'] }
    });
    
    logger.info(`🧹 ${result.deletedCount} anciennes notifications supprimées`);
    return result.deletedCount;
  }
}

module.exports = NotificationService;