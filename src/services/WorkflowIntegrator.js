// src/services/WorkflowNotificationService.js - VERSION AVEC TEMPLATES
const NotificationService = require('./notification.service');
const NotificationTemplateService = require('./notificationTemplate.service');
const { STATUTS_DEMANDE, ROLES } = require('../constants/roles');

class WorkflowNotificationService {

    constructor() {
        this.notificationService = NotificationService;
    }

    /**
     * Notifier avec template
     */
    async notifierAvecTemplate(templateCode, data) {
        try {
            // Récupérer le template
            const template = await NotificationTemplateService.getTemplateByCode(templateCode);
            if (!template) {
                console.warn(`Template ${templateCode} non trouvé`);
                return null;
            }

            // Remplacer les variables dans le template
            const titre = this._remplacerVariables(template.titreTemplate, data);
            const message = this._remplacerVariables(template.messageTemplate, data);

            // Déterminer les destinataires
            const destinataires = await this._getDestinataires(template.destinataireRoles, data);

            const notifications = [];

            for (const destinataire of destinataires) {
                const notification = await this.notificationService.createNotification({
                    utilisateur: destinataire._id,
                    titre,
                    message,
                    entite: data.entite || 'demande',
                    entiteId: data.entiteId || data.demandeId,
                    type: template.type,
                    priorite: template.priorite,
                    categorie: template.categorie,
                    action: 'view',
                    lien: data.lien || `/demandes/${data.demandeId}`,
                    metadata: {
                        templateCode,
                        ...data,
                        type: `TEMPLATE_${templateCode}`
                    },
                    source: 'system',
                    declencheur: data.declencheur,
                    tags: [...template.categorie.split(','), template.type, template.priorite]
                });

                notifications.push(notification);
            }

            return notifications;

        } catch (error) {
            console.error(`Erreur notification template ${templateCode}:`, error);
            return [];
        }
    }

    /**
     * Notifier validation de demande (version template)
     */
    async notifierValidationDemande(demande, validateur, ancienStatut, nouveauStatut) {
        try {
            const templateCode = this._getTemplateCodeForValidation(nouveauStatut);

            const data = {
                demandeId: demande._id,
                numeroReference: demande.numeroReference,
                clientId: demande.clientId,
                conseillerId: demande.conseillerId,
                montant: demande.montant,
                typeOperation: demande.type,
                ancienStatut,
                nouveauStatut,
                validateurId: validateur._id,
                validateurNom: `${validateur.prenom} ${validateur.nom}`,
                validateurRole: validateur.role,
                date: new Date().toISOString(),
                entite: 'demande',
                entiteId: demande._id,
                declencheur: validateur._id
            };

            return await this.notifierAvecTemplate(templateCode, data);

        } catch (error) {
            console.error('Erreur notification validation:', error);
            return [];
        }
    }

    /**
     * Notifier rejet de demande (version template)
     */
    async notifierRejetDemande(demande, rejeteur, motif) {
        try {
            const data = {
                demandeId: demande._id,
                numeroReference: demande.numeroReference,
                clientId: demande.clientId,
                conseillerId: demande.conseillerId,
                montant: demande.montant,
                typeOperation: demande.type,
                motifRefus: motif,
                rejeteurId: rejeteur._id,
                rejeteurNom: `${rejeteur.prenom} ${rejeteur.nom}`,
                rejeteurRole: rejeteur.role,
                date: new Date().toISOString(),
                entite: 'demande',
                entiteId: demande._id,
                declencheur: rejeteur._id
            };

            return await this.notifierAvecTemplate('DEMANDE_REFUSEE', data);

        } catch (error) {
            console.error('Erreur notification rejet:', error);
            return [];
        }
    }

    /**
     * Notifier nouvelle demande assignée (version template)
     */
    async notifierNouvelleDemandeAssignee(demande, conseiller) {
        try {
            // Récupérer les infos client
            const User = require('../models/User');
            const client = await User.findById(demande.clientId).select('nom prenom');

            const data = {
                demandeId: demande._id,
                numeroReference: demande.numeroReference,
                clientId: demande.clientId,
                clientNom: client ? `${client.prenom} ${client.nom}` : 'Client',
                conseillerId: conseiller._id,
                conseillerNom: `${conseiller.prenom} ${conseiller.nom}`,
                montant: demande.montant,
                typeOperation: demande.type,
                date: new Date().toISOString(),
                entite: 'demande',
                entiteId: demande._id,
                lien: `/demandes/${demande._id}`
            };

            return await this.notifierAvecTemplate('DEMANDE_ASSIGNEE', data);

        } catch (error) {
            console.error('Erreur notification assignation:', error);
            return null;
        }
    }

    /**
     * Notifier demande en retard (version template personnalisée)
     */
    async notifierDemandeEnRetard(demande) {
        try {
            // Notification au responsable actuel
            const roleResponsable = this._getResponsibleRole(demande.statut);
            if (roleResponsable) {
                const User = require('../models/User');
                const responsables = await User.find({
                    role: roleResponsable,
                    actif: true
                }).limit(2);

                for (const responsable of responsables) {
                    await this.notificationService.createNotification({
                        utilisateur: responsable._id,
                        titre: `⏰ Demande #${demande.numeroReference} en retard`,
                        message: `Cette demande dépasse le délai de traitement`,
                        entite: 'demande',
                        entiteId: demande._id,
                        type: 'warning',
                        priorite: 'haute',
                        categorie: 'validation',
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
                }
            }

        } catch (error) {
            console.error('Erreur notification retard:', error);
        }
    }

    // ==================== MÉTHODES PRIVÉES ====================

    _getTemplateCodeForValidation(statut) {
        switch (statut) {
            case 'EN_ATTENTE_CONSEILLER':
                return 'DEMANDE_SOUMISE';
            case 'EN_ETUDE_CONSEILLER':
                return 'DEMANDE_CREEE';
            case 'APPROUVEE':
                return 'DEMANDE_VALIDEE';
            case 'REJETEE':
                return 'DEMANDE_REFUSEE';
            default:
                return 'DEMANDE_CREEE';
        }
    }

    async _getDestinataires(roles, data) {
        const User = require('../models/User');
        const destinataires = [];

        // Récupérer les utilisateurs par rôle
        for (const role of roles) {
            switch (role) {
                case 'client':
                    if (data.clientId) {
                        const client = await User.findById(data.clientId);
                        if (client) destinataires.push(client);
                    }
                    break;

                case 'conseiller':
                    if (data.conseillerId) {
                        const conseiller = await User.findById(data.conseillerId);
                        if (conseiller) destinataires.push(conseiller);
                    } else {
                        // Tous les conseillers actifs
                        const conseillers = await User.find({ role: 'conseiller', actif: true }).limit(3);
                        destinataires.push(...conseillers);
                    }
                    break;

                case 'admin':
                    const admins = await User.find({ role: 'admin', actif: true });
                    destinataires.push(...admins);
                    break;

                case 'rm':
                    const rms = await User.find({ role: 'rm', actif: true }).limit(2);
                    destinataires.push(...rms);
                    break;

                case 'dce':
                    const dces = await User.find({ role: 'dce', actif: true }).limit(1);
                    destinataires.push(...dces);
                    break;

                case 'adg':
                    const adgs = await User.find({ role: 'adg', actif: true }).limit(1);
                    destinataires.push(...adgs);
                    break;

                case 'risques':
                    const risques = await User.find({ role: 'risques', actif: true }).limit(2);
                    destinataires.push(...risques);
                    break;
            }
        }

        // Supprimer les doublons
        return destinataires.filter((dest, index, self) =>
            index === self.findIndex(d => d._id.toString() === dest._id.toString())
        );
    }

    _remplacerVariables(template, data) {
        let result = template;

        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value || '');
        }

        return result;
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
}

module.exports = new WorkflowNotificationService();