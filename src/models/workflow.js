// src/models/Workflow.js
const mongoose = require('mongoose');
const { ROLES, STATUTS_DEMANDE, ACTIONS_DEMANDE } = require('../constants/roles');

const workflowSchema = new mongoose.Schema({
    // Identifiant
    nom: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    description: {
        type: String,
        trim: true
    },

    // Type de demande concernée
    typeOperation: {
        type: String,
        enum: Object.values(require('../constants/roles').TYPES_OPERATION),
        required: true
    },

    // Seuils d'application
    conditions: {
        montantMin: { type: Number, default: 0 },
        montantMax: { type: Number, default: null },
        clientMinRating: { type: String, default: 'E' }, // A à E
        clientMaxRating: { type: String, default: 'A' }
    },

    // Étapes du workflow (séquentiel)
    etapes: [{
        ordre: {
            type: Number,
            required: true,
            min: 1
        },

        nom: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            required: true,
            uppercase: true
        },

        // Rôle responsable
        roleResponsable: {
            type: String,
            enum: Object.values(ROLES),
            required: true
        },

        // Statut associé
        statutAssocie: {
            type: String,
            enum: Object.values(STATUTS_DEMANDE),
            required: true
        },

        // Délai maximum (en heures ouvrables)
        delaiMaxHeures: {
            type: Number,
            default: 24,
            min: 1
        },

        // Actions autorisées pour cette étape
        actionsAutorisees: [{
            type: String,
            enum: Object.values(ACTIONS_DEMANDE)
        }],

        // Validations requises
        validationsRequises: {
            signatureElectronique: { type: Boolean, default: false },
            documentsObligatoires: [{
                type: String,
                enum: ['PIECE_IDENTITE', 'JUSTIFICATIF_DOMICILE', 'AVIS_IMPOSITION', 'RIB', 'CONTRAT']
            }],
            quorum: { type: Number, default: 1 } // Nombre de validations nécessaires
        },

        // Notifications
        notifications: {
            rappelHeuresAvant: { type: Number, default: 6 },
            escalationHeuresApres: { type: Number, default: 2 }
        },

        // Conditions de passage
        conditionsPassage: {
            montantSeuil: { type: Number, default: 0 },
            necessiteAnalyseRisques: { type: Boolean, default: false },
            autoValidation: { type: Boolean, default: false }
        }
    }],

    // Configuration générale
    configuration: {
        autoriserSautEtape: { type: Boolean, default: false },
        notificationsActives: { type: Boolean, default: true },
        historiqueComplet: { type: Boolean, default: true },
        retentionJours: {
            type: Number,
            default: 365,
            min: 30
        },

        // Règles spécifiques
        regles: {
            analyseRisquesAuto: { type: Boolean, default: true },
            delegationAuto: { type: Boolean, default: false },
            validationMultiple: { type: Boolean, default: false }
        }
    },

    // Métadonnées
    metadata: {
        version: { type: String, default: '1.0.0' },
        prioriteDefaut: {
            type: String,
            enum: ['URGENTE', 'HAUTE', 'NORMALE'],
            default: 'NORMALE'
        },
        tags: [String],

        // Pour le tracking
        utilisePar: [{
            agence: String,
            dateActivation: { type: Date, default: Date.now }
        }]
    },

    // Statut d'activation
    actif: {
        type: Boolean,
        default: true,
        index: true
    },

    // Audit et tracking
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    reviewedBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: Object.values(ROLES) },
        date: { type: Date, default: Date.now },
        commentaire: String,
        approbation: { type: Boolean, default: false }
    }],

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    },

    // Date d'activation
    activeFrom: {
        type: Date,
        default: Date.now
    },

    activeTo: Date
}, {
    // Options
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ========== INDEX POUR PERFORMANCES ==========
workflowSchema.index({ typeOperation: 1, actif: 1 });
workflowSchema.index({ 'etapes.roleResponsable': 1 });
workflowSchema.index({ 'metadata.prioriteDefaut': 1 });
workflowSchema.index({ 'conditions.montantMin': 1, 'conditions.montantMax': 1 });

// ========== MIDDLEWARES ==========
workflowSchema.pre('save', function (next) {
    this.updatedAt = Date.now();

    // Générer un code si non fourni
    if (!this.code && this.nom) {
        this.code = this.nom
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .substring(0, 20);
    }

    // Valider les étapes
    if (this.etapes && this.etapes.length > 0) {
        const ordres = this.etapes.map(e => e.ordre).sort((a, b) => a - b);
        for (let i = 0; i < ordres.length; i++) {
            if (ordres[i] !== i + 1) {
                throw new Error(`L'ordre des étapes est incorrect. Attendu: ${i + 1}, Trouvé: ${ordres[i]}`);
            }
        }
    }

    next();
});

// ========== MÉTHODES D'INSTANCE ==========

// Valider le workflow
workflowSchema.methods.validerWorkflow = function () {
    const erreurs = [];

    // Vérifier qu'il y a au moins une étape
    if (!this.etapes || this.etapes.length === 0) {
        erreurs.push('Le workflow doit avoir au moins une étape');
    }

    // Vérifier la hiérarchie des rôles
    const roles = this.etapes.map(e => e.roleResponsable);
    const hierarchy = require('../constants/roles').HIERARCHY;

    for (let i = 1; i < roles.length; i++) {
        const currentIndex = hierarchy.indexOf(roles[i]);
        const previousIndex = hierarchy.indexOf(roles[i - 1]);

        if (currentIndex < previousIndex) {
            erreurs.push(`Incohérence hiérarchique: ${roles[i]} ne peut pas venir après ${roles[i - 1]}`);
        }
    }

    return {
        valide: erreurs.length === 0,
        erreurs,
        nombreEtapes: this.etapes.length,
        dureeTotale: this.etapes.reduce((sum, etape) => sum + etape.delaiMaxHeures, 0)
    };
};

// Trouver l'étape par code
workflowSchema.methods.trouverEtapeParCode = function (codeEtape) {
    return this.etapes.find(etape => etape.code === codeEtape);
};

// Trouver la prochaine étape
workflowSchema.methods.trouverProchaineEtape = function (etapeActuelle) {
    return this.etapes.find(etape => etape.ordre === etapeActuelle.ordre + 1);
};

// Cloner le workflow
workflowSchema.methods.clonerWorkflow = async function (userId, nouveauNom) {
    const Workflow = mongoose.model('Workflow');

    const cloneData = this.toObject();
    delete cloneData._id;
    delete cloneData.__v;
    delete cloneData.createdAt;
    delete cloneData.updatedAt;

    cloneData.nom = nouveauNom || `${this.nom} (Copie)`;
    cloneData.code = `${this.code}_COPY`;
    cloneData.createdBy = userId;
    cloneData.reviewedBy = [];
    cloneData.metadata.version = '1.0.0-copy';

    return await Workflow.create(cloneData);
};

// Activer/Désactiver
workflowSchema.methods.activer = function (userId) {
    this.actif = true;
    this.updatedBy = userId;
    this.activeFrom = new Date();
    return this;
};

workflowSchema.methods.desactiver = function (userId) {
    this.actif = false;
    this.updatedBy = userId;
    this.activeTo = new Date();
    return this;
};

// ========== MÉTHODES STATIQUES ==========

// Trouver workflow par type d'opération et montant
workflowSchema.statics.trouverWorkflowParDemande = async function (donneesDemande) {
    const { typeOperation, montant, clientRating } = donneesDemande;

    return await this.findOne({
        typeOperation,
        actif: true,
        'conditions.montantMin': { $lte: montant },
        'conditions.montantMax': { $gte: montant },
        'conditions.clientMinRating': { $gte: clientRating },
        'conditions.clientMaxRating': { $lte: clientRating }
    }).sort({ 'metadata.version': -1, createdAt: -1 });
};

// Workflows par rôle
workflowSchema.statics.trouverWorkflowsParRole = async function (role) {
    return await this.find({
        actif: true,
        'etapes.roleResponsable': role
    }).sort({ typeOperation: 1, 'metadata.prioriteDefaut': 1 });
};

// ========== VIRTUELS ==========

// Nombre d'étapes
workflowSchema.virtual('nombreEtapes').get(function () {
    return this.etapes ? this.etapes.length : 0;
});

// Dernière étape
workflowSchema.virtual('derniereEtape').get(function () {
    if (!this.etapes || this.etapes.length === 0) return null;
    return this.etapes[this.etapes.length - 1];
});

// Première étape
workflowSchema.virtual('premiereEtape').get(function () {
    if (!this.etapes || this.etapes.length === 0) return null;
    return this.etapes[0];
});

// Durée totale estimée
workflowSchema.virtual('dureeTotaleEstimee').get(function () {
    if (!this.etapes) return 0;
    return this.etapes.reduce((total, etape) => total + etape.delaiMaxHeures, 0);
});

// Rôles impliqués
workflowSchema.virtual('rolesImpliques').get(function () {
    if (!this.etapes) return [];
    return [...new Set(this.etapes.map(etape => etape.roleResponsable))];
});

const Workflow = mongoose.model('Workflow', workflowSchema);

module.exports = Workflow;