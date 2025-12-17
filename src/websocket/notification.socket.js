// src/websocket/notification.socket.js
const WebSocket = require('ws');
const NotificationService = require('../services/notification.service');

function setupNotificationWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  
  // Map pour stocker les connexions par utilisateur
  const userConnections = new Map();
  
  wss.on('connection', (ws, req) => {
    // Récupérer l'utilisateur depuis le token (simplifié)
    const token = req.url.split('token=')[1];
    if (!token) {
      ws.close();
      return;
    }
    
    const { getUserFromToken } = require('../utils/jwt.util');
    const user = getUserFromToken(token);
    
    if (!user) {
      ws.close();
      return;
    }
    
    // Stocker la connexion
    if (!userConnections.has(user.id)) {
      userConnections.set(user.id, new Set());
    }
    userConnections.get(user.id).add(ws);
    
    console.log(`🔗 WebSocket connecté: ${user.email} (${userConnections.get(user.id).size} connexions)`);
    
    // Envoyer le nombre de notifications non lues
    NotificationService.getUserNotifications(user.id, { 
      limit: 1, 
      unreadOnly: true 
    }).then(result => {
      ws.send(JSON.stringify({
        type: 'unread_count',
        count: result.pagination.total
      }));
    });
    
    ws.on('close', () => {
      const userWsSet = userConnections.get(user.id);
      if (userWsSet) {
        userWsSet.delete(ws);
        if (userWsSet.size === 0) {
          userConnections.delete(user.id);
        }
      }
    });
  });
  
  // Fonction pour envoyer une notification en temps réel
  function sendRealTimeNotification(userId, notification) {
    const userWsSet = userConnections.get(userId.toString());
    if (userWsSet) {
      const message = JSON.stringify({
        type: 'new_notification',
        notification
      });
      
      userWsSet.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }
  
  return { wss, sendRealTimeNotification };
}

module.exports = setupNotificationWebSocket;