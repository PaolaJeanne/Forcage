// src/models/TrackDemande.js
const mongoose = require('mongoose');
const { ROLES, STATUTS_DEMANDE, ACTIONS_DEMANDE, TRANSITIONS_AUTORISEES } = require('../constants/roles');

const trackDemandeSchema = new mongoose.Schema({
    // Référence à la demande
    demandeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DemandeForçage',
        required: true,
        index: true
    },

    // Référence au workflow utilisé
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflow',
        required: true,
        index: true
    },

    // Étape courante
    etapeCourante: {
        ordre: { type: Number, required: true },
        nom: { type: String, required: true },
        code: { type: String, required: true },
        roleResponsable: { type: String, required: true, enum: Object.values(ROLES) },
        statutAssocie: { type: String, required: true, enum: Object.values(STATUTS_DEMANDE) },

        // Assignation
        assigneA: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },

        // Dates importantes
        dateDebut: { type: Date, default: Date.now },
        dateLimite: { type: Date, required: true },
        dateFin: Date,

        // Validations effectuées
        validationsEffectuees: [{
            validePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            dateValidation: { type: Date, default: Date.now },
            signatureElectronique: String,
            documentsValides: [String]
        }],

        // Commentaires et notes
        commentaires: [{
            auteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            contenu: String,
            date: { type: Date, default: Date.now },
            interne: { type: Boolean, default: true } // visible uniquement en interne
        }],

        // Documents requis pour cette étape
        documentsRequis: [{
            type: String,
            enum: ['PIECE_IDENTITE', 'JUSTIFICATIF_DOMICILE', 'AVIS_IMPOSITION', 'RIB', 'CONTRAT', 'AUTRE'],
            statut: {
                type: String,
                enum: ['REQUIS', 'RECU', 'VALIDE', 'REJETE'],
                default: 'REQUIS'
            },
            url: String,
            nomFichier: String,
            dateDepot: Date
        }]
    },

    // Historique complet des transitions
    historique: [{
        // Transition effectuée
        fromStatut: { type: String, enum: Object.values(STATUTS_DEMANDE) },
        toStatut: { type: String, enum: Object.values(STATUTS_DEMANDE), required: true },

        // Étape concernée
        etape: {
            ordre: Number,
            nom: String,
            code: String,
            roleResponsable: String
        },

        // Action effectuée
        action: {
            type: String,
            enum: Object.values(ACTIONS_DEMANDE),
            required: true
        },

        // Par qui
        effectuePar: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Détails
        details: {
            commentaire: String,
            raison: String,
            montant: Number,
            delegation: {
                delegueA: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                raison: String
            },
            fichiers: [{
                nom: String,
                url: String,
                type: String
            }]
        },

        // Date et heure
        dateAction: {
            type: Date,
            default: Date.now,
            index: true
        },

        // Données techniques
        metadata: {
            ipAddress: String,
            userAgent: String,
            sessionId: String,
            versionApp: String
        }
    }],

    // Statut global
    statutGlobal: {
        type: String,
        enum: Object.values(STATUTS_DEMANDE),
        default: 'BROUILLON',
        index: true
    },

    // Délais et timing
    delais: {
        dateDebutWorkflow: { type: Date, default: Date.now },
        dateFinPrevue: Date,
        dateFinReelle: Date,
        delaiTotalJours: Number,
        respectDelai: { type: Boolean, default: true },
        retardJours: { type: Number, default: 0 }
    },

    // Notifications envoyées
    notifications: [{
        type: {
            type: String,
            enum: ['ASSIGNATION', 'RAPPEL', 'ESCALADE', 'DELAI_DEPASSE', 'INFO_REQUISE', 'VALIDATION', 'REJET']
        },
        destinataire: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dateEnvoi: { type: Date, default: Date.now },
        canal: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] },
        statut: { type: String, enum: ['ENVOYE', 'LU', 'ERREUR'] },
        dateLecture: Date
    }],

    // Escalades
    escalades: [{
        niveau: { type: Number, required: true },
        fromRole: { type: String, enum: Object.values(ROLES) },
        toRole: { type: String, enum: Object.values(ROLES) },
        raison: String,
        initiePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dateEscalade: { type: Date, default: Date.now },
        resolu: { type: Boolean, default: false },
        dateResolution: Date
    }],

    // Métadonnées
    metadata: {
        priorite: {
            type: String,
            enum: ['URGENTE', 'HAUTE', 'NORMALE'],
            default: 'NORMALE'
        },

        niveauRisque: {
            type: String,
            enum: ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'],
            default: 'FAIBLE'
        },

        tags: [String],

        flags: {
            besoinAnalyseRisques: { type: Boolean, default: false },
            validationMultiple: { type: Boolean, default: false },
            signatureElectroniqueRequise: { type: Boolean, default: false },
            delegationActivee: { type: Boolean, default: false }
        },

        // Pour le reporting
        indicateurs: {
            tempsMoyenEtape: Number,
            nombreRejets: { type: Number, default: 0 },
            nombreRetours: { type: Number, default: 0 },
            satisfactionClient: Number // 1-5
        }
    },

    // Logs système
    logs: [{
        niveau: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'] },
        message: String,
        details: mongoose.Schema.Types.Mixed,
        date: { type: Date, default: Date.now },
        source: String // 'system', 'user', 'api'
    }]
}, {
    // Options
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ========== INDEX COMPOSÉS POUR PERFORMANCE ==========
trackDemandeSchema.index({ demandeId: 1, statutGlobal: 1 });
trackDemandeSchema.index({ 'etapeCourante.assigneA': 1, statutGlobal: 1 });
trackDemandeSchema.index({ 'etapeCourante.roleResponsable': 1, statutGlobal: 1 });
trackDemandeSchema.index({ 'metadata.priorite': 1, 'delais.dateFinPrevue': 1 });
trackDemandeSchema.index({ 'delais.dateFinPrevue': 1, statutGlobal: 1 });
trackDemandeSchema.index({ createdAt: -1 });
trackDemandeSchema.index({ 'metadata.niveauRisque': 1 });

// ========== MIDDLEWARES ==========

// Avant sauvegarde
trackDemandeSchema.pre('save', function (next) {
    // Calculer les délais
    if (this.delais.dateFinReelle && this.delais.dateDebutWorkflow) {
        const delaiMs = this.delais.dateFinReelle - this.delais.dateDebutWorkflow;
        this.delais.delaiTotalJours = Math.round(delaiMs / (1000 * 60 * 60 * 24));

        // Calculer retard
        if (this.delais.dateFinPrevue) {
            const retardMs = this.delais.dateFinReelle - this.delais.dateFinPrevue;
            this.delais.retardJours = Math.max(0, Math.round(retardMs / (1000 * 60 * 60 * 24)));
            this.delais.respectDelai = this.delais.retardJours === 0;
        }
    }

    // Vérifier si l'étape est en retard
    if (this.etapeCourante.dateLimite) {
        const maintenant = new Date();
        if (maintenant > this.etapeCourante.dateLimite) {
            this._ajouterLog('WARN', `Étape en retard: dépassement de ${Math.round((maintenant - this.etapeCourante.dateLimite) / (1000 * 60 * 60 * 24))} jours`);
        }
    }

    next();
});

// ========== MÉTHODES D'INSTANCE ==========

// Ajouter une transition
trackDemandeSchema.methods.ajouterTransition = function (transitionData) {
    const transition = {
        fromStatut: this.statutGlobal,
        toStatut: transitionData.toStatut,
        etape: this.etapeCourante,
        action: transitionData.action,
        effectuePar: transitionData.effectuePar,
        details: transitionData.details || {},
        dateAction: new Date(),
        metadata: transitionData.metadata || {}
    };

    this.historique.push(transition);
    this.statutGlobal = transitionData.toStatut;

    // Log
    this._ajouterLog('INFO', `Transition: ${transition.fromStatut} → ${transition.toStatut}`);

    return this;
};

// Assigner l'étape à un utilisateur
trackDemandeSchema.methods.assignerEtape = function (utilisateurId, commentaire) {
    this.etapeCourante.assigneA = utilisateurId;
    this.etapeCourante.dateDebut = new Date();

    // Ajouter commentaire
    this.etapeCourante.commentaires.push({
        auteur: utilisateurId,
        contenu: commentaire || 'Étape assignée',
        date: new Date(),
        interne: true
    });

    // Notification
    this.notifications.push({
        type: 'ASSIGNATION',
        destinataire: utilisateurId,
        dateEnvoi: new Date(),
        canal: 'IN_APP',
        statut: 'ENVOYE'
    });

    this._ajouterLog('INFO', `Étape assignée à l'utilisateur: ${utilisateurId}`);

    return this;
};

// Valider l'étape
trackDemandeSchema.methods.validerEtape = function (validationData) {
    const { validePar, signatureElectronique, documentsValides } = validationData;

    this.etapeCourante.validationsEffectuees.push({
        validePar,
        dateValidation: new Date(),
        signatureElectronique,
        documentsValides: documentsValides || []
    });

    this.etapeCourante.dateFin = new Date();

    this._ajouterLog('INFO', `Étape validée par: ${validePar}`);

    return this;
};

// Vérifier si transition autorisée
trackDemandeSchema.methods.transitionAutorisee = function (versStatut) {
    const transitionsAutorisees = TRANSITIONS_AUTORISEES[this.statutGlobal] || [];
    return transitionsAutorisees.includes(versStatut);
};

// Vérifier permissions utilisateur
trackDemandeSchema.methods.verifierPermissions = async function (utilisateurId) {
    const User = mongoose.model('User');
    const utilisateur = await User.findById(utilisateurId);

    if (!utilisateur) return false;

    // Admin peut tout faire
    if (utilisateur.role === ROLES.ADMIN) return true;

    // Vérifier rôle correspondant
    const roleCorrespond = utilisateur.role === this.etapeCourante.roleResponsable;

    // Vérifier assignation
    const estAssigne = this.etapeCourante.assigneA &&
        this.etapeCourante.assigneA.toString() === utilisateurId.toString();

    return roleCorrespond || estAssigne;
};

// Vérifier documents complets
trackDemandeSchema.methods.documentsComplets = function () {
    if (!this.etapeCourante.documentsRequis) return true;

    return this.etapeCourante.documentsRequis.every(doc =>
        doc.statut === 'VALIDE' || doc.statut === 'RECU'
    );
};

// Calculer temps restant
trackDemandeSchema.methods.tempsRestantHeures = function () {
    if (!this.etapeCourante.dateLimite) return null;

    const maintenant = new Date();
    const diffMs = this.etapeCourante.dateLimite - maintenant;

    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
};

// ========== MÉTHODES STATIQUES ==========

// Trouver tracks par utilisateur
trackDemandeSchema.statics.trouverParUtilisateur = async function (utilisateurId, filtres = {}) {
    const User = mongoose.model('User');
    const utilisateur = await User.findById(utilisateurId);

    if (!utilisateur) return [];

    const query = {
        ...filtres,
        $or: [
            { 'etapeCourante.assigneA': utilisateurId },
            { 'etapeCourante.roleResponsable': utilisateur.role }
        ]
    };

    return await this.find(query)
        .populate('demandeId')
        .populate('workflowId')
        .populate('etapeCourante.assigneA', 'nom prenom email role agence')
        .sort({ 'metadata.priorite': -1, 'etapeCourante.dateLimite': 1 });
};

// Statistiques
trackDemandeSchema.statics.obtenirStatistiques = async function (filtres = {}) {
    const pipeline = [
        { $match: filtres },
        {
            $group: {
                _id: '$statutGlobal',
                total: { $sum: 1 },
                delaiMoyenJours: { $avg: '$delais.delaiTotalJours' },
                retardMoyenJours: { $avg: '$delais.retardJours' }
            }
        },
        { $sort: { total: -1 } }
    ];

    return await this.aggregate(pipeline);
};

// Tâches en retard
trackDemandeSchema.statics.trouverTachesEnRetard = async function () {
    const maintenant = new Date();

    return await this.find({
        statutGlobal: { $in: ['EN_ETUDE_CONSEILLER', 'EN_ATTENTE_RM', 'EN_ATTENTE_DCE', 'EN_ATTENTE_ADG'] },
        'etapeCourante.dateLimite': { $lt: maintenant }
    })
        .populate('demandeId', 'numeroReference montant type')
        .populate('etapeCourante.assigneA', 'nom prenom email')
        .sort({ 'etapeCourante.dateLimite': 1 });
};

// ========== VIRTUELS ==========

// Pourcentage de complétion
trackDemandeSchema.virtual('pourcentageCompletion').get(function () {
    if (!this.workflowId || !this.etapeCourante) return 0;

    // Calcul basé sur l'ordre des étapes
    const etapeActuelle = this.etapeCourante.ordre;
    const totalEtapes = this.workflowId.etapes ? this.workflowId.etapes.length : 1;

    return Math.round((etapeActuelle / totalEtapes) * 100);
});

// Dernière transition
trackDemandeSchema.virtual('derniereTransition').get(function () {
    if (!this.historique || this.historique.length === 0) return null;
    return this.historique[this.historique.length - 1];
});

// Prochaine action suggérée
trackDemandeSchema.virtual('prochaineActionSuggeree').get(function () {
    if (!this.etapeCourante || !this.workflowId) return null;

    const workflow = this.workflowId;
    const etapeCourante = workflow.etapes.find(e => e.ordre === this.etapeCourante.ordre);

    if (etapeCourante && etapeCourante.actionsAutorisees.length > 0) {
        return etapeCourante.actionsAutorisees[0]; // Première action autorisée
    }

    return null;
});

// ========== MÉTHODES PRIVÉES ==========

// Méthode privée pour ajouter des logs
trackDemandeSchema.methods._ajouterLog = function (niveau, message, details = {}) {
    this.logs.push({
        niveau,
        message,
        details,
        date: new Date(),
        source: 'system'
    });
};

const TrackDemande = mongoose.model('TrackDemande', trackDemandeSchema);

module.exports = TrackDemande;