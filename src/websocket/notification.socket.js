module.exports = function(io) {
  
  const notificationNamespace = io.of('/notifications');
  
  notificationNamespace.on('connection', (socket) => {
    console.log('🔔 Nouvelle connexion notifications:', socket.id);
    
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
    
    if (!userId) {
      console.log('⚠️ Connexion sans userId');
      socket.disconnect();
      return;
    }
    
    // Rejoindre la room de l'utilisateur
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} connecté aux notifications`);
    
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
        console.error('❌ Erreur socket notification_read:', error);
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
        console.error('❌ Erreur socket get_unread_count:', error);
      }
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`🔔 Déconnexion notifications: ${socket.id}`);
      socket.leave(`user_${userId}`);
    });
  });
  
  return notificationNamespace;
};