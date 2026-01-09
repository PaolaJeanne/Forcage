const mongoose = require('mongoose');
const DemandeForçage = require('../models/DemandeForçage');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * Récupérer les statistiques des risques
 * Analyse les demandes en fonction de leur score de risque
 */
exports.getStatistics = async (req, res) => {
    try {
        const { startDate, endDate, agencyId } = req.query;

        const matchStage = {
            statut: { $in: ['EN_ANALYSE_RISQUES', 'APPROUVEE', 'REJETEE', 'DECAISSEE'] }
        };

        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
        }

        if (agencyId) {
            if (mongoose.Types.ObjectId.isValid(agencyId)) {
                matchStage.agencyId = new mongoose.Types.ObjectId(agencyId);
            } else {
                logger.warn(`Invalid agencyId passed to statistics: ${agencyId}`);
            }
        }

        const stats = await DemandeForçage.aggregate([
            { $match: matchStage },
            {
                $facet: {
                    byRiskLevel: [
                        {
                            $group: {
                                _id: '$scoreRisque',
                                count: { $sum: 1 },
                                totalMontant: { $sum: '$montant' },
                                avgMontant: { $avg: '$montant' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    byStatus: [
                        {
                            $group: {
                                _id: '$statut',
                                count: { $sum: 1 },
                                totalMontant: { $sum: '$montant' }
                            }
                        }
                    ],
                    byNotation: [
                        {
                            $group: {
                                _id: '$notationClient',
                                count: { $sum: 1 },
                                totalMontant: { $sum: '$montant' }
                            }
                        }
                    ],
                    highRiskDemandes: [
                        {
                            $match: {
                                $or: [
                                    { scoreRisque: 'ELEVE' },
                                    { montant: { $gte: 50000 } },
                                    { notationClient: { $in: ['D', 'E'] } }
                                ]
                            }
                        },
                        { $limit: 10 },
                        {
                            $project: {
                                numeroReference: 1,
                                montant: 1,
                                scoreRisque: 1,
                                notationClient: 1,
                                clientNomComplet: 1,
                                statut: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalDemandes: { $sum: 1 },
                                totalMontant: { $sum: '$montant' },
                                avgMontant: { $avg: '$montant' },
                                maxMontant: { $max: '$montant' },
                                minMontant: { $min: '$montant' }
                            }
                        }
                    ]
                }
            }
        ]);

        // in getStatistics
        const result = stats[0];

        return successResponse(res, 200, 'Statistiques des risques récupérées avec succès', {
            total: result.summary[0]?.totalDemandes || 0,
            totalMontant: result.summary[0]?.totalMontant || 0,
            avgMontant: result.summary[0]?.avgMontant || 0,
            byRiskLevel: result.byRiskLevel,
            byStatus: result.byStatus,
            byNotation: result.byNotation,
            highRiskDemandes: result.highRiskDemandes,
            summary: result.summary[0] || {}
        });

    } catch (error) {
        logger.error('Erreur lors de la récupération des statistiques des risques:', error);
        return errorResponse(res, 500, 'Erreur lors de la récupération des statistiques', process.env.NODE_ENV === 'development' ? error.message : undefined);
    }
};

/**
 * Récupérer toutes les demandes en analyse de risques
 */
exports.getAllRisks = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = '-createdAt', riskLevel, status } = req.query;

        const query = {
            statut: { $in: ['EN_ANALYSE_RISQUES', 'APPROUVEE', 'REJETEE'] }
        };

        if (riskLevel) {
            query.scoreRisque = riskLevel;
        }

        if (status) {
            query.statut = status;
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: sortBy,
            populate: [
                { path: 'clientId', select: 'nom prenom email telephone' },
                { path: 'conseillerId', select: 'nom prenom email' }
            ]
        };

        const demandes = await DemandeForçage.paginate(query, options);

        logger.info(`${demandes.docs.length} demandes en analyse de risques récupérées`);
        return successResponse(res, 200, 'Demandes récupérées avec succès', demandes);
    } catch (error) {
        logger.error('Erreur lors de la récupération des demandes en risques:', error);
        return errorResponse(res, 500, 'Erreur lors de la récupération des demandes');
    }
};

/**
 * Récupérer une demande spécifique en analyse de risques
 */
exports.getRiskById = async (req, res) => {
    try {
        const { riskId } = req.params;

        const demande = await DemandeForçage.findById(riskId)
            .populate('clientId', 'nom prenom email telephone cni numeroCompte')
            .populate('conseillerId', 'nom prenom email')
            .populate('assignedTo', 'nom prenom email');

        if (!demande) {
            return errorResponse(res, 404, 'Demande non trouvée');
        }

        return successResponse(res, 200, 'Demande récupérée avec succès', demande);
    } catch (error) {
        logger.error('Erreur lors de la récupération de la demande:', error);
        return errorResponse(res, 500, 'Erreur lors de la récupération');
    }
};

/**
 * Créer une analyse de risque (assigner une demande à l'analyse)
 */
exports.createRisk = async (req, res) => {
    try {
        const { demandeId, scoreRisque, commentaire } = req.body;

        const demande = await DemandeForçage.findById(demandeId);
        if (!demande) {
            return errorResponse(res, 404, 'Demande non trouvée');
        }

        demande.scoreRisque = scoreRisque || demande.scoreRisque;
        demande.statut = 'EN_ANALYSE_RISQUES';
        demande.assignedTo = req.user.id;
        demande.assignedAt = new Date();

        if (commentaire) {
            demande.commentaireInterne = commentaire;
        }

        await demande.save();

        logger.info(`Analyse de risque créée pour la demande ${demandeId}`);
        return successResponse(res, 201, 'Analyse de risque créée avec succès', demande);
    } catch (error) {
        logger.error('Erreur lors de la création de l\'analyse:', error);
        return errorResponse(res, 500, 'Erreur lors de la création');
    }
};

/**
 * Mettre à jour une analyse de risque
 */
exports.updateRisk = async (req, res) => {
    try {
        const { riskId } = req.params;
        const { scoreRisque, commentaire, statut } = req.body;

        const demande = await DemandeForçage.findById(riskId);
        if (!demande) {
            return errorResponse(res, 404, 'Demande non trouvée');
        }

        if (scoreRisque) demande.scoreRisque = scoreRisque;
        if (commentaire) demande.commentaireInterne = commentaire;
        if (statut) demande.statut = statut;

        await demande.save();

        logger.info(`Analyse de risque mise à jour pour ${riskId}`);
        return successResponse(res, 200, 'Analyse mise à jour avec succès', demande);
    } catch (error) {
        logger.error('Erreur lors de la mise à jour:', error);
        return errorResponse(res, 500, 'Erreur lors de la mise à jour');
    }
};

/**
 * Supprimer une analyse de risque
 */
exports.deleteRisk = async (req, res) => {
    try {
        const { riskId } = req.params;

        const demande = await DemandeForçage.findByIdAndDelete(riskId);
        if (!demande) {
            return errorResponse(res, 404, 'Demande non trouvée');
        }

        logger.info(`Analyse de risque supprimée: ${riskId}`);
        return successResponse(res, 200, 'Analyse supprimée avec succès', null);
    } catch (error) {
        logger.error('Erreur lors de la suppression:', error);
        return errorResponse(res, 500, 'Erreur lors de la suppression');
    }
};

/**
 * Exporter les analyses de risques
 */
exports.exportRisks = async (req, res) => {
    try {
        const { format = 'json', riskLevel, startDate, endDate } = req.query;

        const query = {
            statut: { $in: ['EN_ANALYSE_RISQUES', 'APPROUVEE', 'REJETEE'] }
        };

        if (riskLevel) query.scoreRisque = riskLevel;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const demandes = await DemandeForçage.find(query)
            .populate('clientId', 'nom prenom email')
            .lean();

        if (format === 'csv') {
            const csv = convertToCSV(demandes);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="risques.csv"');
            res.send(csv);
        } else {
            logger.info(`${demandes.length} analyses de risques exportées`);
            return successResponse(res, 200, 'Données exportées avec succès', demandes);
        }
    } catch (error) {
        logger.error('Erreur lors de l\'exportation:', error);
        return errorResponse(res, 500, 'Erreur lors de l\'exportation');
    }
};

/**
 * Convertir les données en CSV
 */
function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = ['Référence', 'Client', 'Montant', 'Score Risque', 'Notation', 'Statut', 'Date'];
    const rows = data.map(d => [
        d.numeroReference,
        d.clientNomComplet || `${d.clientPrenom} ${d.clientNom}`,
        d.montant,
        d.scoreRisque,
        d.notationClient,
        d.statut,
        new Date(d.createdAt).toLocaleDateString('fr-FR')
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    return csv;
}
