//src/controllers/audit.controller.js`
const AuditService = require('../services/audit.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * Récupérer tous les logs d'audit avec filtres
 */
const getAllLogs = async (req, res) => {
  try {
    const {
      utilisateur,
      action,
      entite,
      entiteId,
      dateDebut,
      dateFin,
      page = 1,
      limit = 50
    } = req.query;

    const filters = {
      utilisateur,
      action,
      entite,
      entiteId,
      dateDebut,
      dateFin
    };

    const result = await AuditService.getLogs(filters, parseInt(page), parseInt(limit));

    return successResponse(res, 200, 'Logs d\'audit récupérés', result);

  } catch (error) {

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Récupérer l'historique d'une entité spécifique
 */
const getEntityHistory = async (req, res) => {
  try {
    const { entite, entiteId } = req.params;

    const logs = await AuditService.getEntityHistory(entite, entiteId);

    return successResponse(res, 200, 'Historique récupéré', {
      logs,
      count: logs.length
    });

  } catch (error) {

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Récupérer l'historique d'un utilisateur
 */
const getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await AuditService.getUserHistory(userId, parseInt(limit));

    return successResponse(res, 200, 'Historique utilisateur récupéré', {
      logs,
      count: logs.length
    });

  } catch (error) {

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Récupérer les statistiques d'audit
 */
const getStatistics = async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;

    const stats = await AuditService.getStatistics(dateDebut, dateFin);

    return successResponse(res, 200, 'Statistiques d\'audit récupérées', stats);

  } catch (error) {

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Exporter les logs (CSV ou JSON)
 */
const exportLogs = async (req, res) => {
  try {
    const { format = 'json', dateDebut, dateFin } = req.query;

    const filters = { dateDebut, dateFin };
    const result = await AuditService.getLogs(filters, 1, 10000); // Max 10k logs

    if (format === 'csv') {
      // Convertir en CSV
      const csv = convertToCSV(result.logs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      return res.send(csv);
    }

    // Format JSON par défaut
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
    return res.json(result.logs);

  } catch (error) {

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Nettoyer les anciens logs
 */
const cleanOldLogs = async (req, res) => {
  try {
    const { daysToKeep = 365 } = req.body;

    const deletedCount = await AuditService.cleanOldLogs(parseInt(daysToKeep));

    return successResponse(res, 200, `${deletedCount} logs supprimés`, {
      deletedCount,
      daysToKeep
    });

  } catch (error) {

    return errorResponse(res, 500, 'Erreur serveur');
  }
};

/**
 * Convertir les logs en CSV
 */
const convertToCSV = (logs) => {
  const headers = ['Date', 'Utilisateur', 'Action', 'Entité', 'ID Entité', 'IP'];
  const rows = logs.map(log => [
    log.createdAt.toISOString(),
    log.utilisateur ? `${log.utilisateur.nom} ${log.utilisateur.prenom}` : 'Système',
    log.action,
    log.entite,
    log.entiteId || '',
    log.ipAddress || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
};

module.exports = {
  getAllLogs,
  getEntityHistory,
  getUserHistory,
  getStatistics,
  exportLogs,
  cleanOldLogs
};
