const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { query, param, body } = require('express-validator');

// Toutes les routes nécessitent authentification
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Récupérer les notifications de l'utilisateur
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un nombre positif'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('La limite doit être entre 1 et 200'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly doit être un booléen'),
  query('entite').optional().isString().withMessage('L\'entité doit être une chaîne'),
  query('categorie').optional().isString().withMessage('La catégorie doit être une chaîne'),
  query('priorite').optional().isString().withMessage('La priorité doit être une chaîne')
], NotificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread/count
 * @desc    Récupérer le nombre de notifications non lues
 */
router.get('/unread/count', NotificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/stats
 * @desc    Récupérer les statistiques des notifications
 */
router.get('/stats', NotificationController.getStats);

/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Marquer une notification comme lue
 */
router.patch('/:notificationId/read', [
  param('notificationId').isMongoId().withMessage('ID de notification invalide')
], NotificationController.markAsRead);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Marquer toutes les notifications comme lues
 */
router.patch('/read-all', [
  query('categorie').optional().isString().withMessage('La catégorie doit être une chaîne'),
  query('entite').optional().isString().withMessage('L\'entité doit être une chaîne')
], NotificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Supprimer une notification
 */
router.delete('/:notificationId', [
  param('notificationId').isMongoId().withMessage('ID de notification invalide')
], NotificationController.deleteNotification);

/**
 * @route   POST /api/notifications/admin/create
 * @desc    Créer une notification (admin seulement)
 */
router.post('/admin/create', [
  authorize('admin', 'dga'),
  body('utilisateur').isMongoId().withMessage('ID utilisateur invalide'),
  body('titre').trim().isLength({ min: 1, max: 200 }).withMessage('Le titre doit contenir entre 1 et 200 caractères'),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Le message doit contenir entre 1 et 500 caractères'),
  body('entite').optional().isString().withMessage('L\'entité doit être une chaîne'),
  body('entiteId').optional(),
  body('type').optional().isIn(['info', 'warning', 'success', 'error', 'urgent', 'system']),
  body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente', 'critique']),
  body('categorie').optional().isString().withMessage('La catégorie doit être une chaîne'),
  body('action').optional().isString().withMessage('L\'action doit être une chaîne'),
  body('lien').optional().isURL().withMessage('Lien invalide'),
  body('tags').optional().isArray().withMessage('Les tags doivent être un tableau')
], NotificationController.createNotification);

module.exports = router;