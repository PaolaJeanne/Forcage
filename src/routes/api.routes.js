// routes/api.routes.js
const express = require('express');
const router = express.Router();

// Importer les routes
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin');
const schedulerRoutes = require('./scheduler.routes');
const demandeForçageRoutes = require('./demandeForçage.routes');
const dashboardRoutes = require('./dashboard.routes');
const roleRoutes = require('./roleManagement.routes');
const notificationRoutes = require('./notification.routes');
const chatRoutes = require('./chat.routes');
const documentRoutes = require('./document.routes');
const signatureRoutes = require('./signature.routes');
const workflowRoutes = require('./workflow.routes');
const reportRoutes = require('./report.routes');

// Routes publiques
router.use('/auth', authRoutes);

// Routes protégées (Middleware d'authentification pourrait être ajouté ici si besoin globalement)
router.use('/admin', adminRoutes);
router.use('/scheduler', schedulerRoutes);
router.use('/demandes', demandeForçageRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/roles', roleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes);
router.use('/documents', documentRoutes);
router.use('/signatures', signatureRoutes);
router.use('/workflow', workflowRoutes);
router.use('/reports', reportRoutes);

// Route de santé
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Route 404 pour API
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: [
            '/api/v1/auth/*',
            '/api/v1/admin/*',
            '/api/v1/scheduler/*',
            '/api/v1/demandes/*',
            '/api/v1/dashboard/*',
            '/api/v1/health'
        ]
    });
});

module.exports = router;
