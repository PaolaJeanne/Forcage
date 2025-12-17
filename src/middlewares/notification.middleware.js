// src/middleware/notification.middleware.js
const NotificationService = require('../services/notification.service');

/**
 * Middleware pour ajouter des notifications aux réponses
 */
const injectNotifications = (options = {}) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) return next();
    
    const originalJson = res.json.bind(res);
    
    res.json = async function(data) {
      try {
        // Récupérer les notifications non lues
        const { notifications, pagination } = await NotificationService.getUserNotifications(
          req.user.id,
          { limit: 10, unreadOnly: true }
        );
        
        // Ajouter aux données de réponse
        if (data && typeof data === 'object') {
          data.notifications = {
            unread: notifications,
            unreadCount: pagination.total,
            lastChecked: new Date()
          };
        }
      } catch (error) {
        console.error('Erreur chargement notifications:', error);
        // Ne pas bloquer la réponse en cas d'erreur
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Middleware pour notifier automatiquement certaines actions
 */
const autoNotify = (actionType, entityType) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = async function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Selon le type d'action
          switch (actionType) {
            case 'demande_creation':
              if (data && data.data) {
                const Demande = require('../models/DemandeForçage');
                const demande = await Demande.findById(data.data._id).populate('clientId');
                
                if (demande && demande.clientId) {
                  await NotificationService.notifyDemandeCreation(demande, demande.clientId);
                }
              }
              break;
              
            case 'demande_validation':
              if (req.params.id && req.user) {
                const Demande = require('../models/DemandeForçage');
                const demande = await Demande.findById(req.params.id);
                
                if (demande) {
                  const niveau = req.user.role === 'dga' ? 'final' : 'intermediaire';
                  await NotificationService.notifyDemandeValidation(demande, req.user, niveau);
                }
              }
              break;
              
            case 'audit_alert':
              // À combiner avec le middleware d'audit
              const auditLog = {
                action: req.body.action || 'unknown',
                details: req.body,
                ipAddress: req.ip
              };
              await NotificationService.notifyAuditEvent(auditLog);
              break;
          }
        } catch (error) {
          console.error('Erreur notification automatique:', error);
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

module.exports = {
  injectNotifications,
  autoNotify
};