// src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent authentification
router.use(authenticate);

// Routes principales
router.get('/', NotificationController.getNotifications);
router.get('/unread/count', NotificationController.getUnreadCount);
router.patch('/:notificationId/read', NotificationController.markAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);

// Route admin pour envoyer des notifications manuelles
router.post('/admin/send',
  authorize('admin', 'dga'),
  async (req, res) => {
    try {
      const NotificationService = require('../services/notification.service');
      
      const { userIds, titre, message, type = 'info', priorite = 'moyenne' } = req.body;
      
      const notifications = userIds.map(userId => ({
        utilisateur: userId,
        type,
        titre,
        message,
        priorite,
        metadata: { adminSent: true, sentBy: req.user.id }
      }));
      
      await Notification.insertMany(notifications);
      
      res.json({
        success: true,
        message: `${notifications.length} notifications envoyées`
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur envoi notifications'
      });
    }
  }
);

module.exports = router;