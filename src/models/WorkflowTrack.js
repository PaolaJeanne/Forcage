// src/services/WorkflowIntegrator.js
const WorkflowTrack = require('../models/WorkflowTrack');
const WorkflowService = require('./workflow.service'); // VOTRE service existant

class WorkflowIntegrator {

    /**
     * Synchroniser une demande existante avec le tracking
     */
    async syncDemandeToTrack(demandeId) {
        try {
            // Vérifier si track existe déjà
            let track = await WorkflowTrack.findOne({ demandeId });

            if (!track) {
                // Créer un nouveau track
                track = new WorkflowTrack({ demandeId });
                await track.save();

                // Ajouter l'historique existant
                await this._syncHistorique(demandeId, track);
            }

            return track;

        } catch (error) {
            console.error('Erreur synchronisation track:', error);
            return null;
        }
    }

    /**
     * Enregistrer une action avec tracking
     */
    async logActionWithTrack(demandeId, actionData) {
        try {
            const { action, utilisateurId, roleUtilisateur, commentaire, fromStatut, toStatut } = actionData;

            // Synchroniser le track
            const track = await this.syncDemandeToTrack(demandeId);

            if (track) {
                // Ajouter à l'historique workflow
                track.historiqueWorkflow.push({
                    fromStatut: fromStatut || track.statutCourant,
                    toStatut: toStatut,
                    action,
                    effectuePar: utilisateurId,
                    roleEffectuePar: roleUtilisateur,
                    commentaire
                });

                // Mettre à jour le statut courant
                track.statutCourant = toStatut;
                track.dates.derniereAction = new Date();

                await track.save();
            }

            return track;

        } catch (error) {
            console.error('Erreur log action:', error);
            // Ne pas bloquer l'action principale
            return null;
        }
    }

    /**
     * Obtenir le suivi d'une demande
     */
    async getDemandeTrack(demandeId) {
        return await WorkflowTrack.findOne({ demandeId })
            .populate('donneesDemande.clientId', 'nom prenom email')
            .populate('donneesDemande.conseillerId', 'nom prenom email')
            .populate('historiqueWorkflow.effectuePar', 'nom prenom role');
    }

    /**
     * Obtenir les demandes en retard
     */
    async getDemandesEnRetard() {
        const maintenant = new Date();
        const dateLimite = new Date(maintenant.getTime() - (24 * 60 * 60 * 1000)); // 24h ago

        return await WorkflowTrack.find({
            'dates.derniereAction': { $lt: dateLimite },
            statutCourant: {
                $in: [
                    'EN_ETUDE_CONSEILLER',
                    'EN_ATTENTE_RM',
                    'EN_ATTENTE_DCE',
                    'EN_ATTENTE_ADG',
                    'EN_ANALYSE_RISQUES'
                ]
            }
        })
            .populate('donneesDemande.clientId', 'nom prenom')
            .populate('utilisateurResponsable', 'nom prenom email')
            .sort({ 'dates.derniereAction': 1 });
    }

    /**
     * Obtenir les statistiques workflow
     */
    async getWorkflowStats(filtres = {}) {
        const pipeline = [
            { $match: filtres },
            {
                $group: {
                    _id: '$statutCourant',
                    count: { $sum: 1 },
                    avgMontant: { $avg: '$donneesDemande.montant' },
                    avgDelai: { $avg: '$metriques.delaiTotalHeures' }
                }
            }
        ];

        return await WorkflowTrack.aggregate(pipeline);
    }

    // ========== MÉTHODES PRIVÉES ==========

    async _syncHistorique(demandeId, track) {
        try {
            const DemandeForçage = require('../models/DemandeForçage');
            const demande = await DemandeForçage.findById(demandeId)
                .populate('historiqueValidations.userId');

            if (demande && demande.historiqueValidations) {
                // Convertir l'historique existant en format workflow
                for (const hist of demande.historiqueValidations) {
                    track.historiqueWorkflow.push({
                        toStatut: demande.statut, // On ne connaît pas le fromStatut
                        action: hist.action || 'SYSTEM',
                        effectuePar: hist.userId?._id || hist.userId,
                        roleEffectuePar: hist.role,
                        commentaire: hist.commentaire,
                        dateAction: hist.date
                    });
                }

                await track.save();
            }

        } catch (error) {
            console.error('Erreur sync historique:', error);
        }
    }
}

module.exports = new WorkflowIntegrator();