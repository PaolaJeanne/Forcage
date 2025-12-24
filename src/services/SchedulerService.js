// src/services/SchedulerService.js
const cron = require('node-cron');
const WorkflowNotificationService = require('../services/workflowNotificationService');
const NotificationService = require('./notification.service');
const WorkflowIntegrator = require('./WorkflowIntegrator');
const { STATUTS_DEMANDE } = require('../constants/roles');

class SchedulerService {

    constructor() {
        this.jobs = {};
        this.isInitialized = false;
    }

    /**
     * Initialiser tous les jobs planifiés
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Scheduler déjà initialisé');
            return;
        }

        try {
            console.log('⏰ Initialisation des tâches planifiées...');

            // 1. Vérification quotidienne des demandes en retard (8h du matin)
            this.jobs.dailyRetardCheck = cron.schedule('0 8 * * *', async () => {
                console.log('🕗 Exécution: Vérification des demandes en retard');
                await this.checkDemandesEnRetard();
            }, {
                scheduled: true,
                timezone: "Africa/Douala"
            });

            // 2. Nettoyage des notifications expirées (minuit)
            this.jobs.cleanupNotifications = cron.schedule('0 0 * * *', async () => {
                console.log('🧹 Exécution: Nettoyage notifications expirées');
                await NotificationService.cleanupExpiredNotifications();
            }, {
                scheduled: true,
                timezone: "Africa/Douala"
            });

            // 3. Rappels pour échéances proches (9h et 16h)
            this.jobs.reminders = cron.schedule('0 9,16 * * *', async () => {
                console.log('🔔 Exécution: Rappels échéances');
                await this.sendEcheanceReminders();
            }, {
                scheduled: true,
                timezone: "Africa/Douala"
            });

            // 4. Statistiques quotidiennes (18h)
            this.jobs.stats = cron.schedule('0 18 * * *', async () => {
                console.log('📊 Exécution: Génération statistiques');
                await this.generateDailyStats();
            }, {
                scheduled: true,
                timezone: "Africa/Douala"
            });

            // 5. Vérification santé workflow (toutes les heures)
            this.jobs.healthCheck = cron.schedule('0 * * * *', async () => {
                console.log('❤️ Exécution: Vérification santé workflow');
                await this.workflowHealthCheck();
            }, {
                scheduled: true,
                timezone: "Africa/Douala"
            });

            this.isInitialized = true;
            console.log('✅ Scheduler initialisé avec succès');
            console.log('📅 Jobs actifs:');
            console.log('  • 8h00: Vérification demandes en retard');
            console.log('  • 0h00: Nettoyage notifications');
            console.log('  • 9h00 & 16h00: Rappels échéances');
            console.log('  • 18h00: Statistiques quotidiennes');
            console.log('  • Toutes les heures: Vérification santé');

        } catch (error) {
            console.error('❌ Erreur initialisation scheduler:', error);
        }
    }

    /**
     * Arrêter tous les jobs
     */
    stop() {
        Object.values(this.jobs).forEach(job => {
            if (job && job.stop) job.stop();
        });
        this.isInitialized = false;
        console.log('🛑 Scheduler arrêté');
    }

    /**
     * Vérifier les demandes en retard
     */
    async checkDemandesEnRetard() {
        try {
            const DemandeForçage = require('../models/DemandeForçage');
            const User = require('../models/User');

            // Statuts qui peuvent être en retard
            const statutsVerifiables = [
                'EN_ETUDE_CONSEILLER',
                'EN_ATTENTE_RM',
                'EN_ATTENTE_DCE',
                'EN_ATTENTE_ADG',
                'EN_ANALYSE_RISQUES'
            ];

            // Calculer la date limite (24h avant maintenant)
            const dateLimite = new Date();
            dateLimite.setHours(dateLimite.getHours() - 24);

            // Récupérer les demandes en retard
            const demandesEnRetard = await DemandeForçage.find({
                statut: { $in: statutsVerifiables },
                updatedAt: { $lt: dateLimite },
                'metadata.derniereNotificationRetard': {
                    $ne: new Date().toISOString().split('T')[0] // Pas notifié aujourd'hui
                }
            })
                .populate('clientId', 'nom prenom')
                .populate('conseillerId', 'nom prenom email');

            console.log(`🔍 ${demandesEnRetard.length} demande(s) en retard détectée(s)`);

            for (const demande of demandesEnRetard) {
                try {
                    // Notifier le responsable actuel
                    await WorkflowNotificationService.notifierDemandeEnRetard(demande);

                    // Marquer comme notifié aujourd'hui
                    demande.metadata = demande.metadata || {};
                    demande.metadata.derniereNotificationRetard = new Date().toISOString().split('T')[0];

                    // Ajouter un log
                    demande.historiqueValidations = demande.historiqueValidations || [];
                    demande.historiqueValidations.push({
                        role: 'system',
                        userId: null,
                        nom: 'Système',
                        prenom: '',
                        action: 'RETARD_DETECTE',
                        commentaire: 'Demande en retard - Notification envoyée',
                        date: new Date()
                    });

                    await demande.save();

                    console.log(`⚠️ Notification retard envoyée pour demande ${demande.numeroReference}`);

                } catch (error) {
                    console.error(`❌ Erreur notification retard ${demande._id}:`, error.message);
                }
            }

            // Notifier les administrateurs
            if (demandesEnRetard.length > 0) {
                await this.notifyAdminsAboutDelays(demandesEnRetard);
            }

            return {
                success: true,
                count: demandesEnRetard.length,
                demandes: demandesEnRetard.map(d => d.numeroReference)
            };

        } catch (error) {
            console.error('❌ Erreur vérification retards:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envoyer des rappels pour échéances proches
     */
    async sendEcheanceReminders() {
        try {
            const DemandeForçage = require('../models/DemandeForçage');
            const maintenant = new Date();
            const dans3Jours = new Date(maintenant);
            dans3Jours.setDate(dans3Jours.getDate() + 3);

            // Demandes avec échéance dans les 3 jours
            const demandesEcheanceProche = await DemandeForçage.find({
                dateEcheance: {
                    $gte: maintenant,
                    $lte: dans3Jours
                },
                statut: 'APPROUVEE',
                'metadata.dernierRappelEcheance': {
                    $ne: new Date().toISOString().split('T')[0]
                }
            })
                .populate('clientId', 'nom prenom email')
                .populate('conseillerId', 'nom prenom email');

            console.log(`🔔 ${demandesEcheanceProche.length} demande(s) avec échéance proche`);

            for (const demande of demandesEcheanceProche) {
                try {
                    // Calculer jours restants
                    const joursRestants = Math.ceil(
                        (new Date(demande.dateEcheance) - maintenant) / (1000 * 60 * 60 * 24)
                    );

                    // Notifier le client
                    if (demande.clientId) {
                        await NotificationService.createNotification({
                            utilisateur: demande.clientId._id,
                            titre: `⏰ Échéance dans ${joursRestants} jour(s)`,
                            message: `La demande #${demande.numeroReference} arrive à échéance le ${new Date(demande.dateEcheance).toLocaleDateString('fr-FR')}`,
                            entite: 'demande',
                            entiteId: demande._id,
                            type: 'warning',
                            priorite: joursRestants === 1 ? 'urgente' : 'haute',
                            categorie: 'echeance',
                            action: 'view',
                            lien: `/demandes/${demande._id}`,
                            metadata: {
                                demandeId: demande._id,
                                numeroReference: demande.numeroReference,
                                dateEcheance: demande.dateEcheance,
                                joursRestants,
                                type: 'ECHEANCE_RAPPEL'
                            },
                            source: 'system',
                            tags: ['echeance', 'rappel', `j${joursRestants}`]
                        });
                    }

                    // Notifier le conseiller
                    if (demande.conseillerId) {
                        await NotificationService.createNotification({
                            utilisateur: demande.conseillerId._id,
                            titre: `⏰ Échéance client dans ${joursRestants} jour(s)`,
                            message: `La demande #${demande.numeroReference} de ${demande.clientId.prenom} ${demande.clientId.nom} arrive à échéance`,
                            entite: 'demande',
                            entiteId: demande._id,
                            type: 'warning',
                            priorite: 'normale',
                            categorie: 'echeance',
                            action: 'view',
                            lien: `/demandes/${demande._id}`,
                            metadata: {
                                demandeId: demande._id,
                                numeroReference: demande.numeroReference,
                                clientId: demande.clientId._id,
                                dateEcheance: demande.dateEcheance,
                                joursRestants,
                                type: 'ECHEANCE_RAPPEL_CONSEILLER'
                            },
                            source: 'system',
                            tags: ['echeance', 'conseiller', 'rappel']
                        });
                    }

                    // Marquer comme rappelé aujourd'hui
                    demande.metadata = demande.metadata || {};
                    demande.metadata.dernierRappelEcheance = new Date().toISOString().split('T')[0];
                    await demande.save();

                } catch (error) {
                    console.error(`❌ Erreur rappel échéance ${demande._id}:`, error.message);
                }
            }

            return {
                success: true,
                count: demandesEcheanceProche.length
            };

        } catch (error) {
            console.error('❌ Erreur rappels échéance:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Générer des statistiques quotidiennes
     */
    async generateDailyStats() {
        try {
            const DemandeForçage = require('../models/DemandeForçage');
            const User = require('../models/User');

            const aujourdhui = new Date();
            const hier = new Date(aujourdhui);
            hier.setDate(hier.getDate() - 1);

            // Statistiques pour hier
            const stats = await DemandeForçage.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: hier,
                            $lt: aujourdhui
                        }
                    }
                },
                {
                    $group: {
                        _id: '$statut',
                        count: { $sum: 1 },
                        totalMontant: { $sum: '$montant' },
                        avgMontant: { $avg: '$montant' }
                    }
                }
            ]);

            // Trouver les administrateurs
            const admins = await User.find({
                role: 'admin',
                actif: true
            }).select('_id');

            // Préparer le rapport
            const rapport = {
                date: hier.toISOString().split('T')[0],
                totalDemandes: stats.reduce((sum, stat) => sum + stat.count, 0),
                totalMontant: stats.reduce((sum, stat) => sum + (stat.totalMontant || 0), 0),
                parStatut: stats,
                timestamp: new Date()
            };

            // Envoyer aux administrateurs
            for (const admin of admins) {
                await NotificationService.createNotification({
                    utilisateur: admin._id,
                    titre: `📊 Rapport quotidien - ${rapport.date}`,
                    message: `${rapport.totalDemandes} nouvelles demandes pour ${rapport.totalMontant.toLocaleString()} FCFA`,
                    entite: 'rapport',
                    type: 'info',
                    priorite: 'normale',
                    categorie: 'statistiques',
                    action: 'view',
                    lien: '/admin/statistiques',
                    metadata: {
                        rapport,
                        type: 'DAILY_STATS'
                    },
                    source: 'system',
                    tags: ['statistiques', 'quotidien', 'rapport']
                });
            }

            console.log(`📊 Rapport quotidien généré pour ${rapport.date}: ${rapport.totalDemandes} demandes`);

            return {
                success: true,
                rapport
            };

        } catch (error) {
            console.error('❌ Erreur génération statistiques:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Vérification santé du workflow
     */
    async workflowHealthCheck() {
        try {
            const DemandeForçage = require('../models/DemandeForçage');
            const User = require('../models/User');

            const maintenant = new Date();
            const ilYA48h = new Date(maintenant);
            ilYA48h.setHours(ilYA48h.getHours() - 48);

            // Demandes bloquées (pas de mise à jour depuis 48h)
            const demandesBloquees = await DemandeForçage.find({
                updatedAt: { $lt: ilYA48h },
                statut: {
                    $in: ['EN_ETUDE_CONSEILLER', 'EN_ATTENTE_RM', 'EN_ATTENTE_DCE', 'EN_ATTENTE_ADG']
                }
            }).countDocuments();

            // Conseillers inactifs (pas de connexion depuis 7 jours)
            const ilYA7Jours = new Date(maintenant);
            ilYA7Jours.setDate(ilYA7Jours.getDate() - 7);

            const conseillersInactifs = await User.find({
                role: 'conseiller',
                actif: true,
                derniereConnexion: { $lt: ilYA7Jours }
            }).countDocuments();

            // Vérifier si besoin d'alerte
            if (demandesBloquees > 5 || conseillersInactifs > 0) {
                const admins = await User.find({
                    role: 'admin',
                    actif: true
                }).select('_id');

                for (const admin of admins) {
                    await NotificationService.createNotification({
                        utilisateur: admin._id,
                        titre: `⚠️ Alerte santé workflow`,
                        message: `${demandesBloquees} demande(s) bloquée(s), ${conseillersInactifs} conseiller(s) inactif(s)`,
                        entite: 'systeme',
                        type: 'warning',
                        priorite: 'haute',
                        categorie: 'sante',
                        action: 'view',
                        lien: '/admin/monitoring',
                        metadata: {
                            demandesBloquees,
                            conseillersInactifs,
                            type: 'WORKFLOW_HEALTH_CHECK'
                        },
                        source: 'system',
                        tags: ['sante', 'workflow', 'monitoring']
                    });
                }

                console.log(`❤️ Alerte santé: ${demandesBloquees} blocages, ${conseillersInactifs} inactifs`);
            }

            return {
                success: true,
                demandesBloquees,
                conseillersInactifs,
                timestamp: maintenant
            };

        } catch (error) {
            console.error('❌ Erreur vérification santé:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notifier les admins des retards
     */
    async notifyAdminsAboutDelays(demandesEnRetard) {
        try {
            const User = require('../models/User');
            const admins = await User.find({
                role: 'admin',
                actif: true
            }).select('_id');

            if (admins.length === 0) return;

            const references = demandesEnRetard.map(d => d.numeroReference).join(', ');

            for (const admin of admins) {
                await NotificationService.createNotification({
                    utilisateur: admin._id,
                    titre: `⏰ ${demandesEnRetard.length} demande(s) en retard`,
                    message: `Demandes concernées: ${references}`,
                    entite: 'systeme',
                    type: 'warning',
                    priorite: 'haute',
                    categorie: 'retard',
                    action: 'view',
                    lien: '/admin/demandes/retard',
                    metadata: {
                        count: demandesEnRetard.length,
                        references: demandesEnRetard.map(d => d.numeroReference),
                        type: 'BATCH_DELAY_NOTIFICATION'
                    },
                    source: 'system',
                    tags: ['retard', 'batch', 'admin']
                });
            }

        } catch (error) {
            console.error('❌ Erreur notification admins:', error);
        }
    }

    /**
     * Forcer l'exécution manuelle d'un job
     */
    async runJobManually(jobName) {
        try {
            console.log(`▶️ Exécution manuelle du job: ${jobName}`);

            switch (jobName) {
                case 'checkRetards':
                    return await this.checkDemandesEnRetard();

                case 'cleanupNotifications':
                    return await NotificationService.cleanupExpiredNotifications();

                case 'echeanceReminders':
                    return await this.sendEcheanceReminders();

                case 'dailyStats':
                    return await this.generateDailyStats();

                case 'healthCheck':
                    return await this.workflowHealthCheck();

                default:
                    throw new Error(`Job ${jobName} non trouvé`);
            }

        } catch (error) {
            console.error(`❌ Erreur exécution manuelle ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Obtenir le statut des jobs
     */
    getJobStatus() {
        return {
            isInitialized: this.isInitialized,
            jobs: Object.keys(this.jobs).map(jobName => ({
                name: jobName,
                running: this.jobs[jobName] ? true : false
            }))
        };
    }
}

module.exports = new SchedulerService();