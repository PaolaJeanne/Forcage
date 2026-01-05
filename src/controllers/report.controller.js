
// src/controllers/report.controller.js
const Report = require('../models/Report');
const { successResponse, errorResponse } = require('../utils/response.util');

class ReportController {

    // Lister les rapports de l'utilisateur
    async getReports(req, res) {
        try {
            const { type, statut, limit = 50, page = 1 } = req.query;
            const skip = (page - 1) * limit;

            const reports = await Report.findByUser(req.userId, {
                type,
                statut,
                limit: parseInt(limit),
                skip
            });

            const total = await Report.countDocuments({ utilisateurId: req.userId });

            return successResponse(res, 200, 'Rapports récupérés', {
                reports,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('❌ Erreur getReports:', error);
            return errorResponse(res, 500, 'Erreur lors de la récupération des rapports');
        }
    }

    // Créer un nouveau rapport (génération asynchrone)
    async createReport(req, res) {
        try {
            const { titre, type, format, parametres } = req.body;

            const report = await Report.createReport({
                titre,
                type,
                format,
                utilisateurId: req.userId,
                parametres
            });

            // Ici, on pourrait déclencher un job en arrière-plan pour générer le rapport
            // Pour l'instant on simule une création réussie

            return successResponse(res, 201, 'Demande de rapport créée', { report });
        } catch (error) {
            console.error('❌ Erreur createReport:', error);
            return errorResponse(res, 500, 'Erreur lors de la création du rapport');
        }
    }

    // Récupérer un rapport spécifique
    async getReportById(req, res) {
        try {
            const report = await Report.findOne({
                _id: req.params.id,
                utilisateurId: req.userId
            });

            if (!report) {
                return errorResponse(res, 404, 'Rapport non trouvé');
            }

            return successResponse(res, 200, 'Rapport récupéré', { report });
        } catch (error) {
            console.error('❌ Erreur getReportById:', error);
            return errorResponse(res, 500, 'Erreur lors de la récupération du rapport');
        }
    }

    // Supprimer un rapport
    async deleteReport(req, res) {
        try {
            const report = await Report.findOneAndDelete({
                _id: req.params.id,
                utilisateurId: req.userId
            });

            if (!report) {
                return errorResponse(res, 404, 'Rapport non trouvé');
            }

            return successResponse(res, 200, 'Rapport supprimé');
        } catch (error) {
            console.error('❌ Erreur deleteReport:', error);
            return errorResponse(res, 500, 'Erreur lors de la suppression du rapport');
        }
    }
}

module.exports = new ReportController();
