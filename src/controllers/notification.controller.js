const NotificationService = require('../services/notification.service');
const { validationResult } = require('express-validator');

class NotificationController {

  /**
   * Récupérer les notifications
   */
  static async getNotifications(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 50,
        unreadOnly = false,
        entite = null,
        categorie = null,
        priorite = null
      } = req.query;

      const result = await NotificationService.getUserNotifications(req.user.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unreadOnly === 'true',
        entite,
        categorie,
        priorite
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des notifications'
      });
    }
  }

  /**
   * Récupérer le compteur de notifications non lues
   */
  static async getUnreadCount(req, res) {
    try {
      const count = await NotificationService.getUnreadCount(req.user.id);

      res.json({
        success: true,
        data: { count }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du compteur'
      });
    }
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;

      const notification = await NotificationService.markAsRead(notificationId, req.user.id);

      res.json({
        success: true,
        data: notification
      });

    } catch (error) {


      if (error.message.includes('non trouvée')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage de la notification'
      });
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(req, res) {
    try {
      const { categorie, entite } = req.query;

      const result = await NotificationService.markAllAsRead(req.user.id, {
        categorie,
        entite
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage des notifications'
      });
    }
  }

  /**
   * Supprimer une notification
   */
  static async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;

      const result = await NotificationService.deleteNotification(notificationId, req.user.id);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {


      if (error.message.includes('non trouvée')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de la notification'
      });
    }
  }

  /**
   * Créer une notification (admin)
   */
  static async createNotification(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Vérifier permissions admin
      if (!['admin', 'dga'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Permission refusée'
        });
      }

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
        tags = []
      } = req.body;

      const notification = await NotificationService.createNotification({
        utilisateur,
        titre,
        message,
        entite,
        entiteId,
        type,
        priorite,
        categorie,
        action,
        lien,
        metadata: {
          ...metadata,
          adminCreated: true,
          adminId: req.user.id
        },
        source: 'admin',
        declencheur: req.user.id,
        tags
      });

      res.status(201).json({
        success: true,
        data: notification
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la notification'
      });
    }
  }

  /**
   * Récupérer les statistiques
   */
  static async getStats(req, res) {
    try {
      const Notification = require('../models/Notification');

      // Totaux
      const totalReceived = await Notification.countDocuments({
        utilisateur: req.user.id
      });

      const totalRead = await Notification.countDocuments({
        utilisateur: req.user.id,
        lue: true
      });

      const totalUnread = await Notification.countDocuments({
        utilisateur: req.user.id,
        lue: false
      });

      // Par catégorie
      const byCategory = await Notification.aggregate([
        { $match: { utilisateur: req.user.id } },
        { $group: { _id: '$categorie', total: { $sum: 1 } } }
      ]);

      // Par priorité
      const byPriority = await Notification.aggregate([
        { $match: { utilisateur: req.user.id } },
        { $group: { _id: '$priorite', total: { $sum: 1 } } }
      ]);

      res.json({
        success: true,
        data: {
          totals: {
            received: totalReceived,
            read: totalRead,
            unread: totalUnread,
            readRate: totalReceived > 0 ? Math.round((totalRead / totalReceived) * 100) : 0
          },
          byCategory: byCategory.reduce((acc, item) => {
            acc[item._id] = item.total;
            return acc;
          }, {}),
          byPriority: byPriority.reduce((acc, item) => {
            acc[item._id] = item.total;
            return acc;
          }, {})
        }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = NotificationController;