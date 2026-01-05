// routes/admin/index.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../constants/roles');

// Importer les sous-routes
const usersRoutes = require('./admin.users.routes');
const agenciesRoutes = require('./agencies.routes');
const auditRoutes = require('./audit.routes');
const risksRoutes = require('./risks.routes');

// Middleware pour toutes les routes admin
router.use(authenticate);
router.use(authorize(ROLES.ADMIN, ROLES.DGA, ROLES.ADG));

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
