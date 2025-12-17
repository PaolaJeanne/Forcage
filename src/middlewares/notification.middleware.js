// src/middlewares/notification.middleware.js - VERSION GARANTIE
console.log('🔔 [NOTIFICATION] Middleware notification.middleware.js CHARGÉ !');

/**
 * Version ULTRA-SIMPLE de autoNotify qui fonctionne TOUJOURS
 */
const autoNotify = (actionType, entityType) => {
  console.log(`🔔 [FACTORY] autoNotify créé pour: ${actionType}`);
  
  return async (req, res, next) => {
    console.log(`🔔 [${actionType}] MIDDLEWARE EXÉCUTÉ sur ${req.method} ${req.path}`);
    
    // Sauvegarder la fonction JSON originale
    const originalJson = res.json;
    
    // Remplacer par notre version
    res.json = function(data) {
      console.log(`🔔 [${actionType}] INTERCEPTION - Status: ${res.statusCode}`);
      
      // 1. Envoyer la réponse d'abord
      const result = originalJson.call(this, data);
      
      // 2. Notification en arrière-plan
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`🔔 [${actionType}] Notification asynchrone démarrée`);
        
        // Exécuter après l'envoi de la réponse
        setTimeout(async () => {
          try {
            console.log(`🔔 [${actionType}] Création notification...`);
            
            // Vérifier que le modèle existe
            let Notification;
            try {
              Notification = require('../models/Notification');
            } catch (error) {
              console.error('❌ Modèle Notification non trouvé');
              return;
            }
            
            // Créer une notification SIMPLE
            const notificationData = {
              utilisateur: req.user?.id || 'unknown',
              type: 'info',
              titre: `Notification ${actionType.replace('_', ' ')}`,
              message: `Action ${actionType} effectuée sur ${req.path}`,
              entite: entityType,
              entiteId: data?.data?._id || req.params.id || null,
              lien: req.path,
              lue: false,
              metadata: {
                action: actionType,
                timestamp: new Date().toISOString(),
                user: req.user?.id
              }
            };
            
            console.log('🔔 Données notification:', notificationData);
            
            const notification = await Notification.create(notificationData);
            
            console.log(`✅ [${actionType}] Notification CRÉÉE ! ID: ${notification._id}`);
            
          } catch (error) {
            console.error(`❌ [${actionType}] ERREUR:`, error.message);
          }
        }, 0);
      }
      
      return result;
    };
    
    next();
  };
};

/**
 * Middleware pour injecter les notifications dans les réponses
 */
const injectNotifications = (options = {}) => {
  console.log('🔔 [INJECT] Factory injectNotifications créée');
  
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return next();
    }
    
    const originalJson = res.json.bind(res);
    
    res.json = async function(data) {
      try {
        // Récupérer les notifications
        const Notification = require('../models/Notification');
        const notifications = await Notification.find({
          utilisateur: req.user.id,
          lue: false
        }).limit(5).sort({ createdAt: -1 });
        
        if (data && typeof data === 'object') {
          data.notifications = {
            unread: notifications,
            unreadCount: notifications.length,
            lastChecked: new Date()
          };
        }
      } catch (error) {
        console.error('🔔 [INJECT] Erreur:', error.message);
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

module.exports = {
  autoNotify,
  injectNotifications
};