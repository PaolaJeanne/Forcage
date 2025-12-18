/**
 * Middleware pour les notifications automatiques
 * Version simplifiée et fonctionnelle
 */

const NotificationService = require('../services/notification.service');

/**
 * Middleware autoNotify pour les notifications automatiques
 * @param {string} eventType - Type d'événement (demande_created, demande_updated, etc.)
 * @param {string} entityType - Type d'entité (demande, document, etc.)
 * @returns {Function} Middleware Express
 */
const autoNotify = (eventType, entityType = 'demande') => {
  return async (req, res, next) => {
    // Sauvegarder la fonction res.json originale
    const originalJson = res.json;
    
    // Intercepter la réponse
    res.json = async function(data) {
      try {
        // Restaurer la fonction originale
        res.json = originalJson;
        
        // Si la requête a réussi et qu'il y a des données
        if (data && data.success && data.data && req.user) {
          const entityId = data.data._id || data.data.id;
          const entityData = data.data;
          
          if (entityId) {
            console.log(`🔔 Événement ${eventType} sur ${entityType}: ${entityId}`);
            
            // Déterminer le type de notification
            let notificationType = 'info';
            let priority = 'normale';
            let message = '';
            let recipients = [];
            
            switch (eventType) {
              case 'demande_creation':
              case 'demande_created':
                notificationType = 'success';
                message = `Nouvelle demande créée`;
                if (entityData.clientId) recipients.push(entityData.clientId);
                if (entityData.conseillerId) recipients.push(entityData.conseillerId);
                break;
                
              case 'demande_soumission':
                message = `Demande soumise pour traitement`;
                if (entityData.clientId) recipients.push(entityData.clientId);
                if (entityData.conseillerId) recipients.push(entityData.conseillerId);
                break;
                
              case 'demande_traitement':
                notificationType = entityData.statut === 'validée' ? 'success' : 
                                 entityData.statut === 'rejetée' ? 'error' : 'info';
                message = `Demande traitée: ${entityData.statut}`;
                if (entityData.clientId) recipients.push(entityData.clientId);
                if (entityData.conseillerId) recipients.push(entityData.conseillerId);
                break;
                
              case 'demande_annulation':
                notificationType = 'warning';
                message = `Demande annulée`;
                if (entityData.clientId) recipients.push(entityData.clientId);
                if (entityData.conseillerId) recipients.push(entityData.conseillerId);
                break;
                
              case 'demande_modification':
              case 'demande_updated':
                message = `Demande mise à jour`;
                if (entityData.clientId) recipients.push(entityData.clientId);
                if (entityData.conseillerId) recipients.push(entityData.conseillerId);
                break;
                
              case 'demande_remontee':
                notificationType = 'urgent';
                message = `Demande remontée`;
                priority = 'haute';
                // Notifier les responsables
                recipients = ['admin', 'dga']; // À adapter
                break;
                
              case 'demande_regularisation':
                message = `Demande régularisée`;
                if (entityData.clientId) recipients.push(entityData.clientId);
                if (entityData.conseillerId) recipients.push(entityData.conseillerId);
                break;
                
              default:
                message = `Action ${eventType} effectuée`;
            }
            
            // Envoyer les notifications aux destinataires
            if (recipients.length > 0) {
              for (const recipient of recipients) {
                try {
                  // Si c'est un rôle, on récupère les utilisateurs avec ce rôle
                  if (typeof recipient === 'string' && ['admin', 'dga', 'conseiller'].includes(recipient)) {
                    const User = require('../models/User');
                    const users = await User.find({ 
                      role: recipient,
                      actif: true 
                    }).select('_id');
                    
                    for (const user of users) {
                      await NotificationService.createNotification({
                        utilisateur: user._id,
                        titre: `📋 ${entityType.toUpperCase()} - ${eventType.replace('_', ' ')}`,
                        message: entityData.numeroReference 
                          ? `${message} #${entityData.numeroReference}`
                          : message,
                        entite: entityType,
                        entiteId: entityId,
                        type: notificationType,
                        priorite: priority,
                        categorie: entityType,
                        action: 'view',
                        lien: `/${entityType}s/${entityId}`,
                        metadata: {
                          eventType,
                          entityId,
                          entityData: {
                            id: entityData._id,
                            numeroReference: entityData.numeroReference,
                            statut: entityData.statut,
                            typeOperation: entityData.typeOperation,
                            montant: entityData.montant
                          },
                          triggeredBy: req.user.id,
                          timestamp: new Date()
                        },
                        source: 'system',
                        declencheur: req.user.id,
                        tags: [entityType, eventType, entityData.statut]
                      });
                    }
                  } 
                  // Si c'est un ID utilisateur
                  else if (typeof recipient === 'object' || typeof recipient === 'string') {
                    await NotificationService.createNotification({
                      utilisateur: recipient,
                      titre: `📋 ${entityType.toUpperCase()} - ${eventType.replace('_', ' ')}`,
                      message: entityData.numeroReference 
                        ? `${message} #${entityData.numeroReference}`
                        : message,
                      entite: entityType,
                      entiteId: entityId,
                      type: notificationType,
                      priorite: priority,
                      categorie: entityType,
                      action: 'view',
                      lien: `/${entityType}s/${entityId}`,
                      metadata: {
                        eventType,
                        entityId,
                        triggeredBy: req.user.id
                      },
                      source: 'system',
                      declencheur: req.user.id,
                      tags: [entityType, eventType]
                    });
                  }
                } catch (notifError) {
                  console.error(`❌ Erreur notification pour ${recipient}:`, notifError.message);
                  // Continuer avec les autres destinataires
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Erreur dans autoNotify:', error.message);
        // Ne pas bloquer la réponse en cas d'erreur de notification
      }
      
      // Envoyer la réponse originale
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware pour les notifications de chat
 */
const chatNotify = () => {
  return async (req, res, next) => {
    // Hook pour les messages de chat
    const originalJson = res.json;
    
    res.json = async function(data) {
      try {
        res.json = originalJson;
        
        if (data && data.success && data.data && req.user) {
          const messageData = data.data;
          
          // Si c'est un message de chat
          if (messageData.conversationId && messageData.sender) {
            console.log(`💬 Notification chat: message ${messageData._id}`);
            
            // La notification sera gérée par le hook Message.post('save')
            // via NotificationService.notifyNewMessage()
          }
        }
      } catch (error) {
        console.error('❌ Erreur chatNotify:', error.message);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware pour les notifications système
 */
const systemNotify = (title, message, priority = 'normale') => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = async function(data) {
      try {
        res.json = originalJson;
        
        if (data && data.success && req.user) {
          // Envoyer une notification système à l'utilisateur
          await NotificationService.createNotification({
            utilisateur: req.user.id,
            titre: title,
            message,
            entite: 'systeme',
            type: 'info',
            priorite: priority,
            categorie: 'system',
            action: 'view',
            metadata: {
              systemNotification: true,
              triggeredBy: 'system'
            },
            source: 'system',
            tags: ['system', priority]
          });
        }
      } catch (error) {
        console.error('❌ Erreur systemNotify:', error.message);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware pour nettoyer les notifications
 */
const notificationCleanup = () => {
  return async (req, res, next) => {
    try {
      // Nettoyer les notifications expirées (une fois par jour par exemple)
      const now = new Date();
      const lastCleanup = req.session?.lastNotificationCleanup;
      
      if (!lastCleanup || (now - new Date(lastCleanup)) > 24 * 60 * 60 * 1000) {
        const result = await NotificationService.cleanupExpiredNotifications();
        console.log(`🧹 ${result.deletedCount || 0} notifications expirées nettoyées`);
        
        if (req.session) {
          req.session.lastNotificationCleanup = now;
        }
      }
    } catch (error) {
      console.error('❌ Erreur cleanup notifications:', error.message);
    }
    
    next();
  };
};

/**
 * Middleware pour compter les notifications non lues
 */
const unreadCountMiddleware = () => {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.id) {
        const count = await NotificationService.getUnreadCount(req.user.id);
        req.unreadNotificationCount = count;
        
        // Ajouter au header de réponse
        res.set('X-Unread-Notifications', count);
      }
    } catch (error) {
      console.error('❌ Erreur comptage notifications:', error.message);
      req.unreadNotificationCount = 0;
    }
    
    next();
  };
};

module.exports = {
  autoNotify,
  chatNotify,
  systemNotify,
  notificationCleanup,
  unreadCountMiddleware
};