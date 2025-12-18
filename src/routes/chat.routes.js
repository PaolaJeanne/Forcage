// src/routes/chat.routes.js
const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const { body, param, query } = require('express-validator');

// IMPORT CORRECT du middleware d'authentification
// Assurez-vous que le chemin est correct
const { authenticate } = require('../middlewares/auth.middleware');

// Middleware d'authentification pour toutes les routes
router.use(authenticate );

// ==================== CONVERSATIONS ====================

/**
 * @route   GET /api/chat/conversations
 * @desc    Récupérer les conversations de l'utilisateur
 * @access  Privé
 */
router.get('/conversations', [
  query('type').optional().isIn(['support', 'direct', 'group', 'demande']),
  query('archived').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('search').optional().trim()
], ChatController.getConversations);

/**
 * @route   GET /api/chat/conversations/unread
 * @desc    Récupérer le nombre de messages non lus
 * @access  Privé
 */
router.get('/conversations/unread', ChatController.getUnreadCount);

/**
 * @route   POST /api/chat/conversations
 * @desc    Créer une nouvelle conversation
 * @access  Privé
 */
router.post('/conversations', [
  body('participants')
    .isArray({ min: 1 })
    .withMessage('Les participants sont requis'),
  body('participants.*')
    .isMongoId()
    .withMessage('ID participant invalide'),
  body('type')
    .optional()
    .isIn(['support', 'direct', 'group', 'demande']),
  body('demandeId')
    .optional()
    .isMongoId()
    .withMessage('ID demande invalide'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Le titre doit contenir entre 1 et 100 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne doit pas dépasser 500 caractères')
], ChatController.createConversation);

/**
 * @route   GET /api/chat/conversations/:conversationId
 * @desc    Récupérer une conversation spécifique
 * @access  Privé
 */
router.get('/conversations/:conversationId', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide')
], ChatController.getConversation);

/**
 * @route   GET /api/chat/demande/:demandeId/conversation
 * @desc    Récupérer ou créer la conversation liée à une demande
 * @access  Privé
 */
router.get('/demande/:demandeId/conversation', [
  param('demandeId')
    .isMongoId()
    .withMessage('ID demande invalide')
], ChatController.getOrCreateDemandeConversation);

/**
 * @route   PATCH /api/chat/conversations/:conversationId/archive
 * @desc    Archiver une conversation
 * @access  Privé
 */
router.patch('/conversations/:conversationId/archive', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide')
], ChatController.archiveConversation);

/**
 * @route   PATCH /api/chat/conversations/:conversationId/unarchive
 * @desc    Désarchiver une conversation
 * @access  Privé
 */
router.patch('/conversations/:conversationId/unarchive', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide')
], ChatController.unarchiveConversation);

/**
 * @route   PATCH /api/chat/conversations/:conversationId/read
 * @desc    Marquer une conversation comme lue
 * @access  Privé
 */
router.patch('/conversations/:conversationId/read', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide')
], ChatController.markAsRead);

/**
 * @route   POST /api/chat/conversations/:conversationId/participants
 * @desc    Ajouter un participant à une conversation
 * @access  Privé
 */
router.post('/conversations/:conversationId/participants', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide'),
  body('userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide')
], ChatController.addParticipant);

/**
 * @route   DELETE /api/chat/conversations/:conversationId/participants/:userId
 * @desc    Retirer un participant d'une conversation
 * @access  Privé
 */
router.delete('/conversations/:conversationId/participants/:userId', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide'),
  param('userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide')
], ChatController.removeParticipant);

// ==================== MESSAGES ====================

/**
 * @route   GET /api/chat/conversations/:conversationId/messages
 * @desc    Récupérer les messages d'une conversation
 * @access  Privé
 */
router.get('/conversations/:conversationId/messages', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('La limite doit être entre 1 et 200'),
  query('before')
    .optional()
    .isISO8601()
    .withMessage('Date invalide (format ISO8601 requis)'),
  query('after')
    .optional()
    .isISO8601()
    .withMessage('Date invalide (format ISO8601 requis)'),
  query('includeDeleted')
    .optional()
    .isBoolean()
    .withMessage('includeDeleted doit être un booléen')
], ChatController.getMessages);

/**
 * @route   POST /api/chat/conversations/:conversationId/messages
 * @desc    Envoyer un message dans une conversation
 * @access  Privé
 */
router.post('/conversations/:conversationId/messages', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 0, max: 10000 })
    .withMessage('Le message ne doit pas dépasser 10000 caractères'),
  body('type')
    .optional()
    .isIn(['text', 'file', 'system'])
    .withMessage('Type de message invalide'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Les pièces jointes doivent être un tableau'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('ID message de réponse invalide'),
  body('mentions')
    .optional()
    .isArray()
    .withMessage('Les mentions doivent être un tableau'),
  body('mentions.*')
    .optional()
    .isMongoId()
    .withMessage('ID mention invalide')
], ChatController.sendMessage);

/**
 * @route   POST /api/chat/conversations/:conversationId/messages/:messageId/react
 * @desc    Ajouter/retirer une réaction à un message
 * @access  Privé
 */
router.post('/conversations/:conversationId/messages/:messageId/react', [
  param('conversationId')
    .isMongoId()
    .withMessage('ID conversation invalide'),
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide'),
  body('emoji')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('L\'emoji doit contenir entre 1 et 10 caractères'),
  body('action')
    .optional()
    .isIn(['add', 'remove'])
    .withMessage('Action invalide (add ou remove)')
], ChatController.reactToMessage);

/**
 * @route   PATCH /api/chat/messages/:messageId
 * @desc    Modifier un message
 * @access  Privé
 */
router.patch('/messages/:messageId', [
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Le message doit contenir entre 1 et 10000 caractères')
], ChatController.editMessage);

/**
 * @route   DELETE /api/chat/messages/:messageId
 * @desc    Supprimer un message
 * @access  Privé
 */
router.delete('/messages/:messageId', [
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La raison ne doit pas dépasser 200 caractères')
], ChatController.deleteMessage);

/**
 * @route   POST /api/chat/messages/:messageId/restore
 * @desc    Restaurer un message supprimé
 * @access  Privé
 */
router.post('/messages/:messageId/restore', [
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide')
], ChatController.restoreMessage);

/**
 * @route   GET /api/chat/messages/:messageId/read-info
 * @desc    Récupérer les informations de lecture d'un message
 * @access  Privé
 */
router.get('/messages/:messageId/read-info', [
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide')
], ChatController.getMessageReadInfo);

/**
 * @route   POST /api/chat/messages/:messageId/pin
 * @desc    Épingler un message
 * @access  Privé
 */
router.post('/messages/:messageId/pin', [
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La raison ne doit pas dépasser 200 caractères')
], ChatController.pinMessage);

/**
 * @route   POST /api/chat/messages/:messageId/unpin
 * @desc    Désépingler un message
 * @access  Privé
 */
router.post('/messages/:messageId/unpin', [
  param('messageId')
    .isMongoId()
    .withMessage('ID message invalide')
], ChatController.unpinMessage);

// ==================== STATISTIQUES & RECHERCHE ====================

/**
 * @route   GET /api/chat/stats
 * @desc    Récupérer les statistiques de messagerie
 * @access  Privé
 */
router.get('/stats', [
  query('periode')
    .optional()
    .isIn(['24h', '7d', '30d', '90d'])
    .withMessage('Période invalide')
], ChatController.getStats);

/**
 * @route   GET /api/chat/search/messages
 * @desc    Rechercher dans les messages
 * @access  Privé
 */
router.get('/search/messages', [
  query('q')
    .trim()
    .isLength({ min: 2 })
    .withMessage('La recherche doit contenir au moins 2 caractères'),
  query('conversationId')
    .optional()
    .isMongoId()
    .withMessage('ID conversation invalide'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('La limite doit être entre 1 et 50'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être au moins 1')
], ChatController.searchMessages);

/**
 * @route   GET /api/chat/search/conversations
 * @desc    Rechercher dans les conversations
 * @access  Privé
 */
router.get('/search/conversations', [
  query('q')
    .trim()
    .isLength({ min: 2 })
    .withMessage('La recherche doit contenir au moins 2 caractères'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('La limite doit être entre 1 et 50'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être au moins 1')
], ChatController.searchConversations);

// ==================== UTILITAIRES ====================

/**
 * @route   GET /api/chat/settings
 * @desc    Récupérer les paramètres de chat
 * @access  Privé
 */
router.get('/settings', ChatController.getChatSettings);

/**
 * @route   PUT /api/chat/settings
 * @desc    Mettre à jour les paramètres de chat
 * @access  Privé
 */
router.put('/settings', [
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Les notifications doivent être un objet'),
  body('display')
    .optional()
    .isObject()
    .withMessage('L\'affichage doit être un objet'),
  body('privacy')
    .optional()
    .isObject()
    .withMessage('La confidentialité doit être un objet'),
  body('messaging')
    .optional()
    .isObject()
    .withMessage('La messagerie doit être un objet')
], ChatController.updateChatSettings);

/**
 * @route   POST /api/chat/settings/block/:userId
 * @desc    Bloquer un utilisateur
 * @access  Privé
 */
router.post('/settings/block/:userId', [
  param('userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide')
], ChatController.blockUser);

/**
 * @route   POST /api/chat/settings/unblock/:userId
 * @desc    Débloquer un utilisateur
 * @access  Privé
 */
router.post('/settings/unblock/:userId', [
  param('userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide')
], ChatController.unblockUser);

module.exports = router;