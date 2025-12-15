// ============================================
// 7. ROUTES ADMIN - src/routes/admin.routes.js
// ============================================
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin'));

router.post('/users', adminController.createUser);
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/toggle-status', adminController.toggleUserStatus);

module.exports = router;