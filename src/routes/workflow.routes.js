// src/routes/workflow.routes.js - VERSION AUGMENTÉE
const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const { checkRole } = require('../middlewares/role.middleware');

// Routes existantes
router.patch('/:id/valider', workflowController.valider);
router.patch('/:id/rejeter', workflowController.rejeter);
router.patch('/:id/remonter', workflowController.remonter);
router.patch('/:id/assigner', workflowController.assignerDemande);

// Nouvelles routes workflow
router.get('/:id/workflow-track', workflowController.getWorkflowTrack);
router.get('/demandes-en-retard',
  checkRole(['admin', 'dga', 'adg', 'risques', 'rm']),
  workflowController.getDemandesEnRetard
);
router.get('/stats-workflow',
  checkRole(['admin', 'dga', 'adg', 'risques']),
  workflowController.getStatsWorkflow
);

module.exports = router;