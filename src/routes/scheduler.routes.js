// src/routes/admin/scheduler.routes.js
const express = require('express');
const router = express.Router();
const SchedulerService = require('../services/SchedulerService');
const { checkRole } = require('../middlewares/role.middleware');

/**
 * @route GET /api/v1/admin/scheduler/status
 * @desc Obtenir le statut du scheduler
 * @access Admin seulement
 */
router.get('/status', checkRole(['admin']), (req, res) => {
  try {
    const status = SchedulerService.getJobStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Erreur statut scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur récupération statut'
    });
  }
});

/**
 * @route POST /api/v1/admin/scheduler/run
 * @desc Exécuter un job manuellement
 * @access Admin seulement
 */
router.post('/run', checkRole(['admin']), async (req, res) => {
  try {
    const { job } = req.body;

    if (!job) {
      return res.status(400).json({
        success: false,
        message: 'Nom du job requis'
      });
    }

    const result = await SchedulerService.runJobManually(job);

    res.json({
      success: true,
      message: `Job ${job} exécuté avec succès`,
      data: result
    });

  } catch (error) {
    console.error('Erreur exécution job:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/v1/admin/scheduler/start
 * @desc Démarrer le scheduler
 * @access Admin seulement
 */
router.post('/start', checkRole(['admin']), async (req, res) => {
  try {
    await SchedulerService.initialize();

    res.json({
      success: true,
      message: 'Scheduler démarré avec succès'
    });

  } catch (error) {
    console.error('Erreur démarrage scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur démarrage scheduler'
    });
  }
});

/**
 * @route POST /api/v1/admin/scheduler/stop
 * @desc Arrêter le scheduler
 * @access Admin seulement
 */
router.post('/stop', checkRole(['admin']), (req, res) => {
  try {
    SchedulerService.stop();

    res.json({
      success: true,
      message: 'Scheduler arrêté avec succès'
    });

  } catch (error) {
    console.error('Erreur arrêt scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur arrêt scheduler'
    });
  }
});

/**
 * @route GET /api/v1/admin/scheduler/jobs
 * @desc Lister tous les jobs disponibles
 * @access Admin seulement
 */
router.get('/jobs', checkRole(['admin']), (req, res) => {
  const jobs = [
    {
      name: 'checkRetards',
      description: 'Vérifier les demandes en retard',
      schedule: '0 8 * * *',
      timezone: 'Africa/Douala',
      enabled: true
    },
    {
      name: 'cleanupNotifications',
      description: 'Nettoyer les notifications expirées',
      schedule: '0 0 * * *',
      timezone: 'Africa/Douala',
      enabled: true
    },
    {
      name: 'echeanceReminders',
      description: 'Envoyer les rappels d\'échéance',
      schedule: '0 9,16 * * *',
      timezone: 'Africa/Douala',
      enabled: true
    },
    {
      name: 'dailyStats',
      description: 'Générer les statistiques quotidiennes',
      schedule: '0 18 * * *',
      timezone: 'Africa/Douala',
      enabled: true
    },
    {
      name: 'healthCheck',
      description: 'Vérification santé workflow',
      schedule: '0 * * * *',
      timezone: 'Africa/Douala',
      enabled: true
    }
  ];

  res.json({
    success: true,
    data: jobs
  });
});

module.exports = router;