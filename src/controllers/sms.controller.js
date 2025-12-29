// src/controllers/sms.controller.js
const SMSService = require('../services/sms/sms.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const SMSLog = require('../models/SMSLog');

module.exports = {
  // Envoyer un SMS
  sendSMS: async (req, res) => {
    try {
      const { to, templateCode, variables, options } = req.body;
      
      if (!to || !templateCode) {
        return errorResponse(res, 400, 'Les champs "to" et "templateCode" sont requis');
      }
      
      const result = await SMSService.sendSMS(to, templateCode, variables || {}, {
        ...options,
        userId: req.user._id,
        demandeId: options?.demandeId
      });
      
      if (result.success) {
        return successResponse(res, 200, 'SMS envoyé avec succès', result);
      } else {
        return errorResponse(res, 500, 'Échec envoi SMS', result);
      }
      
    } catch (error) {
      console.error('❌ Erreur contrôleur sendSMS:', error);
      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  },

  // Envoyer des SMS en masse
  sendBulkSMS: async (req, res) => {
    try {
      const { recipients, templateCode, variablesArray, options } = req.body;
      
      if (!recipients || !templateCode || !Array.isArray(recipients)) {
        return errorResponse(res, 400, 'Les champs "recipients" (array) et "templateCode" sont requis');
      }
      
      const result = await SMSService.sendBulkSMS(
        recipients,
        templateCode,
        variablesArray || [],
        {
          ...options,
          userId: req.user._id
        }
      );
      
      return successResponse(res, 200, 'Campagne SMS terminée', result);
      
    } catch (error) {
      console.error('❌ Erreur contrôleur sendBulkSMS:', error);
      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  },

  // Obtenir les statistiques SMS
  getStatistics: async (req, res) => {
    try {
      const { period } = req.query;
      
      const stats = await SMSService.getStatistics(period || '30days');
      
      return successResponse(res, 200, 'Statistiques SMS récupérées', { stats });
      
    } catch (error) {
      console.error('❌ Erreur contrôleur getStatistics:', error);
      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  },

  // Obtenir les logs SMS
  getLogs: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        provider, 
        startDate, 
        endDate,
        search 
      } = req.query;
      
      const filter = {};
      
      if (status) filter.status = status;
      if (provider) filter.provider = provider;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      if (search) {
        filter.$or = [
          { to: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
          { templateCode: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [logs, total] = await Promise.all([
        SMSLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('demandeId', 'code nomClient montant')
          .populate('userId', 'nom prenom email')
          .lean(),
        SMSLog.countDocuments(filter)
      ]);
      
      return successResponse(res, 200, 'Logs SMS récupérés', {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur contrôleur getLogs:', error);
      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  },

  // Retenter les SMS échoués
  retryFailedSMS: async (req, res) => {
    try {
      const { limit } = req.body;
      
      const result = await SMSService.retryFailedSMS(limit || 50);
      
      return successResponse(res, 200, 'Retry des SMS échoués terminé', {
        total: result.length,
        success: result.filter(r => r.success).length,
        failed: result.filter(r => !r.success).length,
        results: result
      });
      
    } catch (error) {
      console.error('❌ Erreur contrôleur retryFailedSMS:', error);
      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  },

  // Tester la connexion aux providers
  testProviders: async (req, res) => {
    try {
      const { testNumber } = req.body;
      
      if (!testNumber) {
        return errorResponse(res, 400, 'Le champ "testNumber" est requis');
      }
      
      const providers = ['orange', 'twilio'];
      const results = [];
      
      for (const provider of providers) {
        try {
          const result = await SMSService.sendWithProvider(
            provider,
            testNumber,
            `Test SMS Provider ${provider} - ${new Date().toLocaleString()}`,
            {}
          );
          
          results.push({
            provider,
            success: result.success,
            message: result.success ? 'Connecté' : result.error,
            response: result
          });
          
        } catch (error) {
          results.push({
            provider,
            success: false,
            message: error.message
          });
        }
        
        // Pause entre les tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return successResponse(res, 200, 'Test providers terminé', { results });
      
    } catch (error) {
      console.error('❌ Erreur contrôleur testProviders:', error);
      return errorResponse(res, 500, 'Erreur serveur', error.message);
    }
  }
};