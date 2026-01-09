// routes/api.routes.js - VERSION RÉORGANISÉE
const express = require('express');
const router = express.Router();

// ==========================================
// ROUTES D'AUTHENTIFICATION (Publiques)
// ==========================================
const authRoutes = require('./auth.routes');
router.use('/auth', authRoutes);

// ==========================================
// ROUTES UTILISATEUR (Authentifiées)
// ==========================================
const userRoutes = require('./user.routes');
router.use('/user', userRoutes);

// ==========================================
// ROUTES ADMIN (Admin seulement)
// ==========================================
const adminRoutes = require('./admin');
router.use('/admin', adminRoutes);

// ==========================================
// AUTRES ROUTES EXISTANTES (Authentifiées)
// ==========================================
const { authenticate } = require('../middlewares/auth.middleware');

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

// Routes protégées existantes
router.use('/scheduler', authenticate, schedulerRoutes);
router.use('/demandes', authenticate, demandeForçageRoutes);
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/roles', authenticate, roleRoutes);
router.use('/notifications', authenticate, notificationRoutes);
router.use('/chat', authenticate, chatRoutes);
router.use('/documents', authenticate, documentRoutes);
router.use('/signatures', authenticate, signatureRoutes);
router.use('/workflow', authenticate, workflowRoutes);
router.use('/reports', authenticate, reportRoutes);

// Alias pour risques (frontend appelle /risques/statistics)
const risksRoutes = require('./admin/risks.routes');
router.use('/risques', authenticate, risksRoutes);

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
