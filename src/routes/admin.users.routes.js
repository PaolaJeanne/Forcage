// admin.users.routes.js - CORRECTION DU CHARGEMENT
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Agency = require('../models/Agency'); // CHANGER CETTE LIGNE
const logger = require('../utils/logger');

const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response.util');

// Middleware pour vérifier que c'est un admin
const requireAdmin = authorize('admin', 'dga');

/**
 * Lister toutes les agences avec stats
 * GET /api/v1/admin/users/agencies
 */
router.get('/agencies', authenticate, async (req, res) => {
  try {
    logger.info('📊 GET /agencies - User:', req.user?.role);
    
    if (!req.user) {
      logger.warn('⚠️ User not authenticated');
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    // Vérifier si le modèle Agency est chargé
    if (!Agency) {
      logger.error('❌ Agency model is not defined');
      return res.status(503).json({
        success: false,
        message: 'Service agences non disponible',
        error: 'Agency model not loaded'
      });
    }

    logger.info(`📊 Agency model loaded successfully: ${typeof Agency}`);

    const userRole = req.user.role;
    let agencies = [];

    logger.info(`📊 Fetching agencies for role: ${userRole}`);

    // Pour les admins, récupérer toutes les agences actives
    if (['admin', 'dga', 'adg'].includes(userRole)) {
      logger.info('📊 Admin/DGA/ADG - fetching all active agencies');
      
      // Utiliser la méthode statique du modèle
      agencies = await Agency.findActive();
      
      // Populate les conseillers pour avoir leurs détails
      agencies = await Agency.find({ isActive: true })
        .sort({ name: 1 })
        .populate('conseillers.userId', 'nom prenom email role')
        .populate('responsables.userId', 'nom prenom email role')
        .lean();
        
    } else if (userRole === 'conseiller') {
      logger.info(`📊 Conseiller - fetching agencies for user: ${req.user.id}`);
      
      // Utiliser la méthode statique pour trouver les agences du conseiller
      agencies = await Agency.findByConseiller(req.user.id)
        .populate('conseillers.userId', 'nom prenom email')
        .lean();
        
    } else {
      logger.warn(`⚠️ Role ${userRole} not authorized to view agencies`);
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // Formater la réponse
    const formatted = agencies.map(agency => {
      // Calculer les stats par rôle
      const byRole = {};
      
      // Compter les conseillers
      const conseillerCount = agency.conseillers?.length || 0;
      if (conseillerCount > 0) {
        byRole['conseiller'] = conseillerCount;
      }
      
      // Compter les responsables par type de rôle
      if (agency.responsables && agency.responsables.length > 0) {
        const roleCounts = {};
        agency.responsables.forEach(resp => {
          const role = resp.role || 'manager';
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        });
        
        Object.entries(roleCounts).forEach(([role, count]) => {
          byRole[role] = count;
        });
      }

      return {
        id: agency._id,
        _id: agency._id,
        name: agency.name,
        description: agency.description || '',
        region: agency.region || '',
        city: agency.city || '',
        address: agency.address || '',
        phone: agency.phone || '',
        email: agency.email || '',
        isActive: agency.isActive,
        totalUsers: (agency.conseillers?.length || 0) + (agency.responsables?.length || 0),
        byRole: byRole,
        totalConseillers: agency.conseillers?.length || 0,
        totalResponsables: agency.responsables?.length || 0,
        conseillers: agency.conseillers || [],
        responsables: agency.responsables || [],
        createdAt: agency.createdAt,
        updatedAt: agency.updatedAt
      };
    });

    logger.info(`✅ Found ${formatted.length} agencies for user ${req.user.id}`);
    
    return res.json({
      success: true,
      message: 'Agences récupérées avec succès',
      data: {
        total: formatted.length,
        agencies: formatted
      }
    });

  } catch (error) {
    logger.error('❌ GET /agencies error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des agences',
      error: error.message
    });
  }
});

/**
 * Créer une agence
 * POST /api/v1/admin/users/agencies
 */
router.post('/agencies', authenticate, requireAdmin, async (req, res) => {
  try {
    logger.info('📊 POST /agencies - Body:', req.body);

    const { 
      name, 
      description, 
      region, 
      city, 
      address, 
      phone, 
      email 
    } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return errorResponse(res, 400, 'Le nom de l\'agence est requis');
    }

    // Vérifier si l'agence existe déjà
    const existingAgency = await Agency.findOne({ 
      name: name.trim() 
    });

    if (existingAgency) {
      return errorResponse(res, 409, 'Une agence avec ce nom existe déjà');
    }

    // Créer l'agence
    const agency = new Agency({
      name: name.trim(),
      description: description?.trim() || '',
      region: region?.trim() || '',
      city: city?.trim() || '',
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      email: email?.trim()?.toLowerCase() || '',
      isActive: true
    });

    await agency.save();

    logger.info(`✅ Agence créée: ${agency.name} (ID: ${agency._id})`);

    return successResponse(res, 201, 'Agence créée avec succès', {
      agency: {
        id: agency._id,
        name: agency.name,
        description: agency.description,
        region: agency.region,
        city: agency.city,
        isActive: agency.isActive
      }
    });

  } catch (error) {
    logger.error('❌ Erreur création agence:', error.message);
    
    if (error.name === 'ValidationError') {
      return errorResponse(res, 400, 'Données invalides', error.message);
    }
    
    if (error.code === 11000) {
      return errorResponse(res, 409, 'Cette agence existe déjà');
    }
    
    return errorResponse(res, 500, 'Erreur lors de la création de l\'agence', error.message);
  }
});

/**
 * Assigner un utilisateur à une agence
 * PUT /api/v1/admin/users/:userId/assign-agency
 */
router.put('/:userId/assign-agency', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { agence, role = 'conseiller' } = req.body;

    if (!agence || agence.trim() === '') {
      return errorResponse(res, 400, 'Le nom de l\'agence est requis');
    }

    logger.info(`📊 Assignation utilisateur ${userId} à l'agence: ${agence} (rôle: ${role})`);

    // 1. Trouver l'agence
    const agency = await Agency.findOne({ 
      name: agence.trim(),
      isActive: true 
    });

    if (!agency) {
      return errorResponse(res, 404, 'Agence non trouvée');
    }

    // 2. Trouver l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'Utilisateur non trouvé');
    }

    // 3. Retirer l'utilisateur de toute autre agence
    await Agency.updateMany(
      {
        $or: [
          { 'conseillers.userId': userId },
          { 'responsables.userId': userId }
        ]
      },
      {
        $pull: {
          conseillers: { userId: userId },
          responsables: { userId: userId }
        }
      }
    );

    // 4. Ajouter l'utilisateur à la nouvelle agence
    if (role === 'conseiller') {
      agency.addConseiller(userId);
    } else {
      // Pour les rôles de responsables
      if (!agency.responsables.find(r => r.userId.toString() === userId.toString())) {
        agency.responsables.push({
          userId: userId,
          role: role
        });
      }
    }

    await agency.save();

    // 5. Mettre à jour l'agence dans le profil utilisateur
    user.agence = agency.name;
    await user.save();

    logger.info(`✅ Utilisateur ${user.email} assigné à l'agence ${agency.name} (rôle: ${role})`);

    return successResponse(res, 200, 'Utilisateur assigné à l\'agence', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence
      },
      agency: {
        id: agency._id,
        name: agency.name,
        totalConseillers: agency.conseillers.length,
        totalResponsables: agency.responsables.length
      }
    });

  } catch (error) {
    logger.error('❌ Erreur assignation agence:', error.message);
    return errorResponse(res, 500, 'Erreur lors de l\'assignation', error.message);
  }
});

/**
 * Lister tous les utilisateurs d'une agence
 * GET /api/v1/admin/users/agency/:agence
 */
router.get('/agency/:agence', authenticate, requireAdmin, async (req, res) => {
  try {
    const { agence } = req.params;
    
    if (!agence || agence.trim() === '') {
      return errorResponse(res, 400, 'Nom d\'agence requis');
    }

    logger.info(`📊 Récupération utilisateurs pour l'agence: ${agence}`);

    // Trouver l'agence
    const agency = await Agency.findOne({ 
      name: agence.trim(),
      isActive: true 
    })
    .populate('conseillers.userId', 'nom prenom email role agence isActive')
    .populate('responsables.userId', 'nom prenom email role agence isActive');

    if (!agency) {
      return errorResponse(res, 404, 'Agence non trouvée');
    }

    // Combiner conseillers et responsables
    const allUsers = [];
    
    // Ajouter les conseillers
    if (agency.conseillers && agency.conseillers.length > 0) {
      agency.conseillers.forEach(cons => {
        if (cons.userId) {
          allUsers.push({
            ...cons.userId.toObject(),
            agenceRole: 'conseiller',
            assignedAt: cons.assignedAt
          });
        }
      });
    }

    // Ajouter les responsables
    if (agency.responsables && agency.responsables.length > 0) {
      agency.responsables.forEach(resp => {
        if (resp.userId) {
          allUsers.push({
            ...resp.userId.toObject(),
            agenceRole: resp.role || 'manager',
            assignedAt: resp.assignedAt
          });
        }
      });
    }

    logger.info(`📊 ${allUsers.length} utilisateurs trouvés pour ${agence}`);
    
    return successResponse(res, 200, `Utilisateurs de ${agence}`, {
      agency: {
        id: agency._id,
        name: agency.name,
        totalUsers: allUsers.length
      },
      users: allUsers.map(user => ({
        id: user._id,
        _id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agence: user.agence,
        agenceRole: user.agenceRole,
        isActive: user.isActive,
        assignedAt: user.assignedAt,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }))
    });

  } catch (error) {
    logger.error('❌ Erreur listage utilisateurs:', error.message);
    return errorResponse(res, 500, 'Erreur lors du listage', error.message);
  }
});

module.exports = router;