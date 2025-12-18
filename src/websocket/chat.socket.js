const ChatService = require('../services/chat.service');
const NotificationService = require('../services/notification.service');

module.exports = function(io) {
  const chatNamespace = io.of('/chat');
  
  chatNamespace.on('connection', (socket) => {
    console.log(`🔌 Nouvelle connexion chat: ${socket.id}`);
    
    // Associer l'utilisateur
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
    
    if (!userId) {
      console.log('⚠️ Connexion chat sans userId, déconnexion');
      socket.disconnect();
      return;
    }
    
    // Rejoindre la room de l'utilisateur
    socket.join(`user_${userId}`);
    console.log(`👤 Utilisateur ${userId} connecté au chat (socket: ${socket.id})`);
    
    // Envoyer un accusé de connexion
    socket.emit('connected', {
      message: 'Connecté au chat en temps réel',
      userId,
      timestamp: new Date()
    });
    
    // Rejoindre les conversations de l'utilisateur
    socket.on('join_conversations', async (conversationIds) => {
      if (Array.isArray(conversationIds)) {
        conversationIds.forEach(conversationId => {
          socket.join(`conversation_${conversationId}`);
          console.log(`👥 ${userId} a rejoint la conversation ${conversationId}`);
        });
      }
    });
    
    // Rejoindre une conversation spécifique
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`👥 ${userId} a rejoint la conversation ${conversationId}`);
    });
    
    // Quitter une conversation
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`👋 ${userId} a quitté la conversation ${conversationId}`);
    });
    
    // Écouter l'envoi de messages
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, content, replyTo, attachments = [], mentions = [] } = data;
        
        if (!conversationId || !content?.trim()) {
          if (callback) {
            callback({
              success: false,
              message: 'Conversation ID et contenu requis'
            });
          }
          return;
        }
        
        console.log(`📤 ${userId} envoie un message à la conversation ${conversationId}`);
        
        // Envoyer le message
        const message = await ChatService.sendMessage(
          conversationId,
          userId,
          content,
          { 
            replyTo,
            attachments,
            mentions
          }
        );
        
        // Diffuser le message à tous les participants
        chatNamespace.to(`conversation_${conversationId}`).emit('new_message', {
          conversationId,
          message,
          senderId: userId,
          timestamp: new Date()
        });
        
        // Mettre à jour le compteur de notifications
        if (global.io && global.io.of('/notifications')) {
          const conversation = await require('../models/Conversation').findById(conversationId)
            .populate('participants', '_id');
          
          if (conversation) {
            conversation.participants.forEach(participant => {
              if (participant._id.toString() !== userId.toString()) {
                // Mettre à jour le compteur pour chaque participant
                global.io.of('/notifications').emit('unread_count_update', {
                  userId: participant._id,
                  timestamp: new Date()
                });
              }
            });
          }
        }
        
        // Callback de succès
        if (callback) {
          callback({
            success: true,
            messageId: message._id,
            conversationId,
            timestamp: new Date()
          });
        }
        
        console.log(`✅ Message ${message._id} envoyé par ${userId}`);
        
      } catch (error) {
        console.error('❌ Erreur socket send_message:', error);
        if (callback) {
          callback({
            success: false,
            message: error.message || 'Erreur lors de l\'envoi du message'
          });
        }
      }
    });
    
    // Marquer une conversation comme lue
    socket.on('mark_as_read', async (conversationId) => {
      try {
        if (!conversationId) {
          console.log('⚠️ mark_as_read sans conversationId');
          return;
        }
        
        await ChatService.markConversationAsRead(conversationId, userId);
        
        // Notifier les autres participants (optionnel)
        socket.to(`conversation_${conversationId}`).emit('user_read', {
          conversationId,
          userId,
          timestamp: new Date()
        });
        
        console.log(`✅ ${userId} a marqué la conversation ${conversationId} comme lue`);
        
      } catch (error) {
        console.error('❌ Erreur socket mark_as_read:', error);
      }
    });
    
    // Marquer un message comme lu
    socket.on('mark_message_read', async (messageId) => {
      try {
        if (!messageId) {
          console.log('⚠️ mark_message_read sans messageId');
          return;
        }
        
        await ChatService.markMessageAsRead(messageId, userId);
        
        console.log(`✅ ${userId} a marqué le message ${messageId} comme lu`);
        
      } catch (error) {
        console.error('❌ Erreur socket mark_message_read:', error);
      }
    });
    
    // Typing indicator
    socket.on('typing', (conversationId) => {
      if (!conversationId) return;
      
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        timestamp: new Date()
      });
    });
    
    // Stop typing
    socket.on('stop_typing', (conversationId) => {
      if (!conversationId) return;
      
      socket.to(`conversation_${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userId,
        timestamp: new Date()
      });
    });
    
    // Écouter les demandes d'état
    socket.on('get_status', () => {
      socket.emit('status', {
        connected: true,
        userId,
        socketId: socket.id,
        timestamp: new Date()
      });
    });
    
    // Déconnexion
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Déconnexion chat: ${socket.id}, raison: ${reason}`);
      
      // Notifier les conversations actives que l'utilisateur est hors ligne
      socket.rooms.forEach(room => {
        if (room.startsWith('conversation_')) {
          socket.to(room).emit('user_offline', {
            userId,
            room,
            timestamp: new Date()
          });
        }
      });
    });
    
    // Gérer les erreurs
    socket.on('error', (error) => {
      console.error('❌ Erreur socket chat:', error);
    });
  });
  
  return chatNamespace;
};