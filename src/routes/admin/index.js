// routes/admin/index.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');

// Importer les sous-routes
const usersRoutes = require('./admin.users.routes');
const auditRoutes = require('./audit.routes');
const risksRoutes = require('./risks.routes');

// Middleware pour toutes les routes admin - authentification seulement
// Les autorisations spécifiques sont gérées dans chaque sous-route
router.use(authenticate);

// Routes
router.use('/', usersRoutes);
router.use('/audit', auditRoutes);
router.use('/risques', risksRoutes);

// Route de test/admin
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Admin API is working',
        user: {
            id: req.user.id,
            role: req.user.role,
            email: req.user.email
        }
    });
});

module.exports = router;
