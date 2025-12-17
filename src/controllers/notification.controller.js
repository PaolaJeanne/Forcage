// src/controllers/notification.controller.js
const NotificationService = require('../services/notification.service');
const { successResponse, errorResponse } = require('../utils/response.util');

class NotificationController {
  
  /**
   * Récupérer les notifications de l'utilisateur
   */
  static async getNotifications(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        unreadOnly = false,
        type 
      } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unreadOnly === 'true'
      };
      
      if (type) options.type = type;
      
      const result = await NotificationService.getUserNotifications(
        req.user.id,
        options
      );
      
      return successResponse(res, 200, 'Notifications récupérées', result);
      
    } catch (error) {
      return errorResponse(res, 500, 'Erreur récupération notifications', error.message);
    }
  }
  
  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      
      const notification = await NotificationService.markAsRead(notificationId, req.user.id);
      
      return successResponse(res, 200, 'Notification marquée comme lue', { notification });
      
    } catch (error) {
      return errorResponse(res, 400, error.message);
    }
  }
  
  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(req, res) {
    try {
      const count = await NotificationService.markAllAsRead(req.user.id);
      
      return successResponse(res, 200, `${count} notifications marquées comme lues`, { count });
      
    } catch (error) {
      return errorResponse(res, 500, 'Erreur mise à jour notifications', error.message);
    }
  }
  
  /**
   * Compter les notifications non lues
   */
  static async getUnreadCount(req, res) {
    try {
      const result = await NotificationService.getUserNotifications(req.user.id, {
        limit: 1,
        unreadOnly: true
      });
      
      return successResponse(res, 200, 'Nombre de notifications non lues', {
        unreadCount: result.pagination.total
      });
      
    } catch (error) {
      return errorResponse(res, 500, 'Erreur comptage notifications', error.message);
    }
  }
  
  /**
   * Supprimer une notification
   */
  static async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      
      const Notification = require('../models/Notification');
      const result = await Notification.deleteOne({
        _id: notificationId,
        utilisateur: req.user.id
      });
      
      if (result.deletedCount === 0) {
        return errorResponse(res, 404, 'Notification non trouvée');
      }
      
      return successResponse(res, 200, 'Notification supprimée');
      
    } catch (error) {
      return errorResponse(res, 500, 'Erreur suppression notification', error.message);
    }
  }
}

module.exports = NotificationController;