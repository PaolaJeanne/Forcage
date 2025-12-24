// src/services/WorkflowNotificationService.js
const NotificationService = require('./notification.service');
const { STATUTS_DEMANDE, ROLES } = require('../constants/roles');

class WorkflowNotificationService {

    constructor() {
        this.notificationService = NotificationService;
    }

    /**
     * Notifier validation de demande (intégré avec workflow)
     */
    async notifierValidationDemande(demande, validateur, ancienStatut, nouveauStatut) {
        try {
            const destinataires = [];
            const notifications = [];

            // 1. Notifier le CLIENT
            if (demande.clientId) {
                destinataires.push({
                    id: demande.clientId,
                    type: 'client'
                });
            }

            // 2. Notifier le CONSEILLER
            if (demande.conseillerId && demande.conseillerId.toString() !== validateur._id.toString()) {
                destinataires.push({
                    id: demande.conseillerId,
                    type: 'conseiller'
                });
            }

            // 3. Notifier le prochain RESPONSABLE
            if (nouveauStatut !== 'APPROUVEE' && nouveauStatut !== 'REJETEE') {
                const prochainRole = this._getResponsibleRole(nouveauStatut);
                if (prochainRole) {
                    // Chercher les utilisateurs avec ce rôle
                    const User = require('../models/User');
                    const responsables = await User.find({
                        role: prochainRole,
                        actif: true
                    }).limit(3); // Notifier les 3 premiers

                    for (const responsable of responsables) {
                        if (responsable._id.toString() !== validateur._id.toString()) {
                            destinataires.push({
                                id: responsable._id,
                                type: prochainRole
                            });
                        }
                    }
                }
            }

            // 4. Notifier SERVICE RISQUES si nécessaire
            if (nouveauStatut === 'EN_ANALYSE_RISQUES') {
                const User = require('../models/User');
                const risquesUsers = await User.find({
                    role: 'risques',
                    actif: true
                }).limit(2);

                for (const user of risquesUsers) {
                    destinataires.push({
                        id: user._id,
                        type: 'risques'
                    });
                }
            }

            // Créer les notifications pour chaque destinataire
            for (const destinataire of destinataires) {
                const notificationData = this._prepareNotificationData(
                    demande,
                    validateur,
                    ancienStatut,
                    nouveauStatut,
                    destinataire.type
                );

                if (notificationData) {
                    const notification = await this.notificationService.createNotification({
                        utilisateur: destinataire.id,
                        titre: notificationData.titre,
                        message: notificationData.message,
                        entite: 'demande',
                        entiteId: demande._id,
                        type: notificationData.type,
                        priorite: notificationData.priorite,
                        categorie: 'workflow',
                        action: 'view',
                        lien: `/demandes/${demande._id}`,
                        metadata: {
                            demandeId: demande._id,
                            numeroReference: demande.numeroReference,
                            ancienStatut,
                            nouveauStatut,
                            validateurId: validateur._id,
                            validateurNom: `${validateur.prenom} ${validateur.nom}`,
                            validateurRole: validateur.role,
                            type: 'WORKFLOW_VALIDATION'
                        },
                        source: 'system',
                        declencheur: validateur._id,
                        tags: ['workflow', 'validation', nouveauStatut.toLowerCase()]
                    });

                    notifications.push(notification);
                }
            }

            return notifications;

        } catch (error) {
            console.error('Erreur notification validation:', error);
            return [];
        }
    }

    /**
     * Notifier rejet de demande
     */
    async notifierRejetDemande(demande, rejeteur, motif) {
        try {
            const notifications = [];

            // 1. Notifier le CLIENT
            if (demande.clientId) {
                const notification = await this.notificationService.createNotification({
                    utilisateur: demande.clientId,
                    titre: `❌ Demande #${demande.numeroReference} rejetée`,
                    message: `Votre demande a été rejetée. Motif: ${motif}`,
                    entite: 'demande',
                    entiteId: demande._id,
                    type: 'error',
                    priorite: 'haute',
                    categorie: 'workflow',
                    action: 'view',
                    lien: `/demandes/${demande._id}`,
                    metadata: {
                        demandeId: demande._id,
                        numeroReference: demande.numeroReference,
                        motifRejet: motif,
                        rejeteurId: rejeteur._id,
                        rejeteurNom: `${rejeteur.prenom} ${rejeteur.nom}`,
                        rejeteurRole: rejeteur.role,
                        type: 'WORKFLOW_REJECT'
                    },
                    source: 'system',
                    declencheur: rejeteur._id,
                    tags: ['workflow', 'rejet', 'demande']
                });

                notifications.push(notification);
            }

            // 2. Notifier le CONSEILLER si différent du rejeteur
            if (demande.conseillerId && demande.conseillerId.toString() !== rejeteur._id.toString()) {
                const notification = await this.notificationService.createNotification({
                    utilisateur: demande.conseillerId,
                    titre: `❌ Demande #${demande.numeroReference} rejetée`,
                    message: `La demande de votre client a été rejetée par ${rejeteur.role.toUpperCase()}`,
                    entite: 'demande',
                    entiteId: demande._id,
                    type: 'warning',
                    priorite: 'normale',
                    categorie: 'workflow',
                    action: 'view',
                    lien: `/demandes/${demande._id}`,
                    metadata: {
                        demandeId: demande._id,
                        numeroReference: demande.numeroReference,
                        motifRejet: motif,
                        clientId: demande.clientId,
                        type: 'WORKFLOW_REJECT_NOTIFY_ADVISOR'
                    },
                    source: 'system',
                    declencheur: rejeteur._id,
                    tags: ['workflow', 'rejet', 'conseiller']
                });

                notifications.push(notification);
            }

            return notifications;

        } catch (error) {
            console.error('Erreur notification rejet:', error);
            return [];
        }
    }

    /**
     * Notifier remontée de demande
     */
    async notifierRemonteeDemande(demande, initiateur, niveau, commentaire) {
        try {
            const prochainRole = this._getRoleFromNiveau(niveau);
            if (!prochainRole) return [];

            // Chercher les utilisateurs du prochain niveau
            const User = require('../models/User');
            const responsables = await User.find({
                role: prochainRole,
                actif: true
            }).limit(3);

            const notifications = [];

            for (const responsable of responsables) {
                const notification = await this.notificationService.createNotification({
                    utilisateur: responsable._id,
                    titre: `📤 Demande #${demande.numeroReference} à valider`,
                    message: `Une demande nécessite votre validation (remontée par ${initiateur.role})`,
                    entite: 'demande',
                    entiteId: demande._id,
                    type: 'info',
                    priorite: 'normale',
                    categorie: 'workflow',
                    action: 'view',
                    lien: `/demandes/${demande._id}`,
                    metadata: {
                        demandeId: demande._id,
                        numeroReference: demande.numeroReference,
                        montant: demande.montant,
                        initiateurId: initiateur._id,
                        initiateurNom: `${initiateur.prenom} ${initiateur.nom}`,
                        initiateurRole: initiateur.role,
                        nouveauNiveau: niveau,
                        commentaire,
                        type: 'WORKFLOW_ESCALATION'
                    },
                    source: 'system',
                    declencheur: initiateur._id,
                    tags: ['workflow', 'escalation', niveau.toLowerCase()]
                });

                notifications.push(notification);
            }

            return notifications;

        } catch (error) {
            console.error('Erreur notification remontée:', error);
            return [];
        }
    }

    /**
     * Notifier demande en retard
     */
    async notifierDemandeEnRetard(demande) {
        try {
            const notifications = [];

            // 1. Notifier l'utilisateur responsable actuel
            const roleResponsable = this._getResponsibleRole(demande.statut);
            if (roleResponsable) {
                const User = require('../models/User');
                const responsables = await User.find({
                    role: roleResponsable,
                    actif: true
                }).limit(2);

                for (const responsable of responsables) {
                    const notification = await this.notificationService.createNotification({
                        utilisateur: responsable._id,
                        titre: `⏰ Demande #${demande.numeroReference} en retard`,
                        message: `Cette demande dépasse le délai de traitement`,
                        entite: 'demande',
                        entiteId: demande._id,
                        type: 'warning',
                        priorite: 'haute',
                        categorie: 'workflow',
                        action: 'view',
                        lien: `/demandes/${demande._id}`,
                        metadata: {
                            demandeId: demande._id,
                            numeroReference: demande.numeroReference,
                            statut: demande.statut,
                            delaiDepasse: true,
                            type: 'WORKFLOW_DELAY'
                        },
                        source: 'system',
                        declencheur: null,
                        tags: ['workflow', 'retard', 'delai']
                    });

                    notifications.push(notification);
                }
            }

            // 2. Notifier le superviseur (niveau supérieur)
            const niveauSuperieur = this._getNiveauSuperieur(demande.statut);
            if (niveauSuperieur) {
                const roleSuperieur = this._getRoleFromNiveau(niveauSuperieur);
                if (roleSuperieur) {
                    const User = require('../models/User');
                    const superviseurs = await User.find({
                        role: roleSuperieur,
                        actif: true
                    }).limit(1);

                    for (const superviseur of superviseurs) {
                        const notification = await this.notificationService.createNotification({
                            utilisateur: superviseur._id,
                            titre: `⚠️ Demande #${demande.numeroReference} en escalade retard`,
                            message: `Une demande en retard nécessite votre attention`,
                            entite: 'demande',
                            entiteId: demande._id,
                            type: 'urgent',
                            priorite: 'critique',
                            categorie: 'workflow',
                            action: 'view',
                            lien: `/demandes/${demande._id}`,
                            metadata: {
                                demandeId: demande._id,
                                numeroReference: demande.numeroReference,
                                statut: demande.statut,
                                delaiDepasse: true,
                                escalation: true,
                                type: 'WORKFLOW_DELAY_ESCALATION'
                            },
                            source: 'system',
                            declencheur: null,
                            tags: ['workflow', 'retard', 'escalation', 'critique']
                        });

                        notifications.push(notification);
                    }
                }
            }

            return notifications;

        } catch (error) {
            console.error('Erreur notification retard:', error);
            return [];
        }
    }

    /**
     * Notifier nouvelle demande assignée
     */
    async notifierNouvelleDemandeAssignee(demande, conseiller) {
        try {
            return await this.notificationService.createNotification({
                utilisateur: conseiller._id,
                titre: `📋 Nouvelle demande #${demande.numeroReference} assignée`,
                message: `Une nouvelle demande vous a été assignée`,
                entite: 'demande',
                entiteId: demande._id,
                type: 'info',
                priorite: 'normale',
                categorie: 'workflow',
                action: 'view',
                lien: `/demandes/${demande._id}`,
                metadata: {
                    demandeId: demande._id,
                    numeroReference: demande.numeroReference,
                    clientId: demande.clientId,
                    montant: demande.montant,
                    typeOperation: demande.type,
                    type: 'NEW_DEMANDE_ASSIGNED'
                },
                source: 'system',
                declencheur: null,
                tags: ['workflow', 'assignation', 'nouvelle']
            });

        } catch (error) {
            console.error('Erreur notification assignation:', error);
            return null;
        }
    }

    /**
     * Notifier approbation finale
     */
    async notifierApprobationFinale(demande, approbateur) {
        try {
            const notifications = [];

            // 1. Notifier le CLIENT
            if (demande.clientId) {
                const notification = await this.notificationService.createNotification({
                    utilisateur: demande.clientId,
                    titre: `✅ Demande #${demande.numeroReference} approuvée !`,
                    message: `Félicitations ! Votre demande a été approuvée`,
                    entite: 'demande',
                    entiteId: demande._id,
                    type: 'success',
                    priorite: 'haute',
                    categorie: 'workflow',
                    action: 'view',
                    lien: `/demandes/${demande._id}`,
                    metadata: {
                        demandeId: demande._id,
                        numeroReference: demande.numeroReference,
                        montant: demande.montant,
                        dateApprobation: new Date(),
                        approbateurId: approbateur._id,
                        approbateurNom: `${approbateur.prenom} ${approbateur.nom}`,
                        type: 'FINAL_APPROVAL'
                    },
                    source: 'system',
                    declencheur: approbateur._id,
                    tags: ['workflow', 'approbation', 'success', 'final']
                });

                notifications.push(notification);
            }

            // 2. Notifier le CONSEILLER
            if (demande.conseillerId) {
                const notification = await this.notificationService.createNotification({
                    utilisateur: demande.conseillerId,
                    titre: `✅ Demande #${demande.numeroReference} approuvée`,
                    message: `La demande de votre client a été approuvée`,
                    entite: 'demande',
                    entiteId: demande._id,
                    type: 'success',
                    priorite: 'normale',
                    categorie: 'workflow',
                    action: 'view',
                    lien: `/demandes/${demande._id}`,
                    metadata: {
                        demandeId: demande._id,
                        numeroReference: demande.numeroReference,
                        clientId: demande.clientId,
                        type: 'ADVISOR_NOTIFY_APPROVAL'
                    },
                    source: 'system',
                    declencheur: approbateur._id,
                    tags: ['workflow', 'approbation', 'conseiller']
                });

                notifications.push(notification);
            }

            return notifications;

        } catch (error) {
            console.error('Erreur notification approbation:', error);
            return [];
        }
    }

    // ==================== MÉTHODES PRIVÉES ====================

    _prepareNotificationData(demande, validateur, ancienStatut, nouveauStatut, destinataireType) {
        const statutMessages = {
            'EN_ATTENTE_CONSEILLER': {
                client: {
                    titre: '📤 Demande soumise',
                    message: 'Votre demande a été soumise à votre conseiller',
                    type: 'info',
                    priorite: 'normale'
                },
                conseiller: {
                    titre: '📋 Nouvelle demande assignée',
                    message: 'Une nouvelle demande nécessite votre attention',
                    type: 'info',
                    priorite: 'normale'
                }
            },
            'EN_ETUDE_CONSEILLER': {
                client: {
                    titre: '🔍 Demande en étude',
                    message: 'Votre conseiller étudie votre demande',
                    type: 'info',
                    priorite: 'normale'
                }
            },
            'EN_ATTENTE_RM': {
                client: {
                    titre: '📈 Demande en attente RM',
                    message: 'Votre demande est en attente de validation par le Responsable d\'Agence',
                    type: 'info',
                    priorite: 'normale'
                },
                rm: {
                    titre: '📋 Demande à valider (niveau RM)',
                    message: `Une demande nécessite votre validation`,
                    type: 'info',
                    priorite: 'normale'
                }
            },
            'EN_ATTENTE_DCE': {
                client: {
                    titre: '📈 Demande en attente DCE',
                    message: 'Votre demande est en attente de validation par le Directeur Commercial',
                    type: 'info',
                    priorite: 'normale'
                },
                dce: {
                    titre: '📋 Demande à valider (niveau DCE)',
                    message: 'Une demande nécessite votre validation',
                    type: 'info',
                    priorite: 'normale'
                }
            },
            'EN_ATTENTE_ADG': {
                client: {
                    titre: '📈 Demande en attente ADG',
                    message: 'Votre demande est en attente de validation par l\'ADG',
                    type: 'info',
                    priorite: 'normale'
                },
                adg: {
                    titre: '📋 Demande à valider (niveau ADG)',
                    message: 'Une demande nécessite votre validation',
                    type: 'info',
                    priorite: 'normale'
                }
            },
            'EN_ANALYSE_RISQUES': {
                client: {
                    titre: '🔒 Demande en analyse risques',
                    message: 'Votre demande est en cours d\'analyse par le service risques',
                    type: 'info',
                    priorite: 'normale'
                },
                risques: {
                    titre: '🔍 Analyse risques requise',
                    message: 'Une demande nécessite votre analyse',
                    type: 'warning',
                    priorite: 'normale'
                }
            },
            'APPROUVEE': {
                client: {
                    titre: '✅ Demande approuvée !',
                    message: 'Félicitations ! Votre demande a été approuvée',
                    type: 'success',
                    priorite: 'haute'
                },
                conseiller: {
                    titre: '✅ Demande approuvée',
                    message: 'La demande de votre client a été approuvée',
                    type: 'success',
                    priorite: 'normale'
                }
            }
        };

        const config = statutMessages[nouveauStatut];
        if (!config) return null;

        return config[destinataireType] || config.client || null;
    }

    _getResponsibleRole(statut) {
        switch (statut) {
            case 'EN_ATTENTE_CONSEILLER':
            case 'EN_ETUDE_CONSEILLER':
                return 'conseiller';
            case 'EN_ATTENTE_RM':
                return 'rm';
            case 'EN_ATTENTE_DCE':
                return 'dce';
            case 'EN_ATTENTE_ADG':
                return 'adg';
            case 'EN_ANALYSE_RISQUES':
                return 'risques';
            default:
                return null;
        }
    }

    _getRoleFromNiveau(niveau) {
        switch (niveau.toUpperCase()) {
            case 'CONSEILLER': return 'conseiller';
            case 'RM': return 'rm';
            case 'DCE': return 'dce';
            case 'ADG': return 'adg';
            case 'RISQUES': return 'risques';
            default: return null;
        }
    }

    _getNiveauSuperieur(statut) {
        switch (statut) {
            case 'EN_ETUDE_CONSEILLER':
                return 'RM';
            case 'EN_ATTENTE_RM':
                return 'DCE';
            case 'EN_ATTENTE_DCE':
                return 'ADG';
            case 'EN_ATTENTE_ADG':
                return 'RISQUES';
            default:
                return null;
        }
    }
}

module.exports = new WorkflowNotificationService();