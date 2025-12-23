
// src/routes/chat.routes.js - VERSION SIMPLIFIÉE
const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// Liste des membres de l'équipe disponibles
router.get('/team', ChatController.getTeamMembers);

// Démarrer une conversation avec un membre précis
router.post('/messages', ChatController.startmessages);

// Démarrer une conversation de support (conseiller auto-assigné)
router.post('/support', ChatController.startSupport);

// Chat lié à une demande
router.get('/demande/:demandeId', ChatController.getDemandeChat);

// Liste des conversations
router.get('/conversations', ChatController.getConversations);

// Nombre de messages non lus
router.get('/unread', ChatController.getUnreadCount);

// Messages d'une conversation
router.get('/:conversationId/messages', ChatController.getMessages);

// Envoyer un message
router.post('/:conversationId/messages', ChatController.sendMessage);

// Marquer comme lu
router.patch('/:conversationId/read', ChatController.markAsRead);

module.exports = router;