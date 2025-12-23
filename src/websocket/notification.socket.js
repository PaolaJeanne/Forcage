module.exports = function (io) {

  const notificationNamespace = io.of('/notifications');

  notificationNamespace.on('connection', (socket) => {


    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;

    if (!userId) {

      socket.disconnect();
      return;
    }

    // Rejoindre la room de l'utilisateur
    socket.join(`user_${userId}`);


    // Accusé de connexion
    socket.emit('connected', {
      message: 'Connecté aux notifications',
      userId,
      timestamp: new Date()
    });

    // Écouter les événements de lecture
    socket.on('notification_read', async (data) => {
      try {
        const NotificationService = require('../services/notification.service');
        await NotificationService.markAsRead(data.notificationId, userId);
      } catch (error) {

      }
    });

    // Écouter les demandes de comptage
    socket.on('get_unread_count', async () => {
      try {
        const NotificationService = require('../services/notification.service');
        const count = await NotificationService.getUnreadCount(userId);

        socket.emit('unread_count_update', {
          count,
          timestamp: new Date()
        });
      } catch (error) {

      }
    });

    // Déconnexion
    socket.on('disconnect', () => {

      socket.leave(`user_${userId}`);
    });
  });

  return notificationNamespace;
};