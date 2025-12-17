//src/services/audit.service.js`

const { AuditLog } = require('../models');
const logger = require('../utils/logger');

class AuditService {
  
  /**
   * Créer un log d'audit
   */
  static async log(data) {
    try {
      const auditLog = new AuditLog({
        utilisateur: data.userId,
        action: data.action,
        entite: data.entite,
        entiteId: data.entiteId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      });
      
      await auditLog.save();
      return auditLog;
    } catch (error) {
      logger.error('Erreur audit service:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer l'historique d'audit d'une entité
   */
  static async getEntityHistory(entite, entiteId) {
    try {
      const logs = await AuditLog.find({ entite, entiteId })
        .populate('utilisateur', 'nom prenom email role')
        .sort({ createdAt: -1 });
      
      return logs;
    } catch (error) {
      logger.error('Erreur récupération historique:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer l'historique d'un utilisateur
   */
  static async getUserHistory(userId, limit = 50) {
    try {
      const logs = await AuditLog.find({ utilisateur: userId })
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return logs;
    } catch (error) {
      logger.error('Erreur récupération historique utilisateur:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer tous les logs avec filtres
   */
  static async getLogs(filters = {}, page = 1, limit = 50) {
    try {
      const query = {};
      
      if (filters.utilisateur) query.utilisateur = filters.utilisateur;
      if (filters.action) query.action = filters.action;
      if (filters.entite) query.entite = filters.entite;
      if (filters.entiteId) query.entiteId = filters.entiteId;
      
      // Filtres de date
      if (filters.dateDebut || filters.dateFin) {
        query.createdAt = {};
        if (filters.dateDebut) query.createdAt.$gte = new Date(filters.dateDebut);
        if (filters.dateFin) query.createdAt.$lte = new Date(filters.dateFin);
      }
      
      const logs = await AuditLog.find(query)
        .populate('utilisateur', 'nom prenom email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);
      
      const total = await AuditLog.countDocuments(query);
      
      return {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      };
    } catch (error) {
      logger.error('Erreur récupération logs:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer les statistiques d'audit
   */
  static async getStatistics(dateDebut, dateFin) {
    try {
      const matchStage = {};
      if (dateDebut || dateFin) {
        matchStage.createdAt = {};
        if (dateDebut) matchStage.createdAt.$gte = new Date(dateDebut);
        if (dateFin) matchStage.createdAt.$lte = new Date(dateFin);
      }
      
      const stats = await AuditLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      const byEntite = await AuditLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$entite',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      const byUser = await AuditLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$utilisateur',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Peupler les informations utilisateur
      await AuditLog.populate(byUser, {
        path: '_id',
        select: 'nom prenom email role'
      });
      
      return {
        parAction: stats,
        parEntite: byEntite,
        topUtilisateurs: byUser,
        total: await AuditLog.countDocuments(matchStage)
      };
    } catch (error) {
      logger.error('Erreur statistiques audit:', error);
      throw error;
    }
  }
  
  /**
   * Nettoyer les anciens logs (RGPD)
   */
  static async cleanOldLogs(daysToKeep = 365) {
    try {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - daysToKeep);
      
      const result = await AuditLog.deleteMany({
        createdAt: { $lt: dateLimit }
      });
      
      logger.info(`${result.deletedCount} logs d'audit supprimés (> ${daysToKeep} jours)`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Erreur nettoyage logs:', error);
      throw error;
    }
  }
}

module.exports = AuditService;