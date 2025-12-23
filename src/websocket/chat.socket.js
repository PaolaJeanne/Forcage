const ChatService = require('../services/chat.service');
const NotificationService = require('../services/notification.service');

module.exports = function (io) {
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {


    // Associer l'utilisateur
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;

    if (!userId) {

      socket.disconnect();
      return;
    }

    // Rejoindre la room de l'utilisateur
    socket.join(`user_${userId}`);


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

        });
      }
    });

    // Rejoindre une conversation spécifique
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);

    });

    // Quitter une conversation
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);

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



      } catch (error) {

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

          return;
        }

        await ChatService.markConversationAsRead(conversationId, userId);

        // Notifier les autres participants (optionnel)
        socket.to(`conversation_${conversationId}`).emit('user_read', {
          conversationId,
          userId,
          timestamp: new Date()
        });



      } catch (error) {

      }
    });

    // Marquer un message comme lu
    socket.on('mark_message_read', async (messageId) => {
      try {
        if (!messageId) {

          return;
        }

        await ChatService.markMessageAsRead(messageId, userId);



      } catch (error) {

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

    });
  });

  return chatNamespace;
};