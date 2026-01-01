// src/models/DemandeForçage.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {
  STATUTS_DEMANDE,
  NOTATIONS_CLIENT,
  PRIORITES,
  SCORES_RISQUE,
  TYPES_OPERATION,
  DEVISE
} = require('../constants/roles');

// Schéma pour les pièces justificatives
const PieceJustificativeSchema = new Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  taille: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Schéma pour l'historique
const HistoriqueEntrySchema = new Schema({
  action: {
    type: String,
    required: true
  },
  statutAvant: {
    type: String,
    enum: Object.values(STATUTS_DEMANDE)
  },
  statutApres: {
    type: String,
    enum: Object.values(STATUTS_DEMANDE),
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  commentaire: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Schéma principal
const DemandeForçageSchema = new Schema({
  // Références
  numeroReference: {
    type: String,
    required: true
    // RETIRÉ: index: true - Défini plus bas dans les index
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conseillerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  agenceId: {
    type: String,
    default: 'Agence Centrale'
  },

  // Informations demande
  motif: {
    type: String,
    required: true,
    trim: true
  },
  motifDerogation: {
    type: String,
    trim: true
  },
  montant: {
    type: Number,
    required: true,
    min: 10000, // Minimum 10.000 FCFA
    max: 100000000 // Maximum 100.000.000 FCFA
  },
  montantAutorise: Number,
  typeOperation: {
    type: String,
    enum: TYPES_OPERATION,
    default: 'VIREMENT'
  },
  compteNumero: String,
  compteDebit: String,
  devise: {
    type: String,
    enum: DEVISE,
    default: 'XAF'
  },
  dureeExhaustive: Number,
  tauxInteret: Number,
  garanties: [String],
  observations: String,

  // Évaluation et notation
  notationClient: {
    type: String,
    enum: NOTATIONS_CLIENT,
    default: 'C'
  },
  classification: {
    type: String,
    enum: ['normal', 'premium', 'entreprise'],
    default: 'normal'
  },
  scoreRisque: {
    type: String,
    enum: SCORES_RISQUE,
    default: 'MOYEN'
  },
  priorite: {
    type: String,
    enum: PRIORITES,
    default: 'NORMALE'
  },

  // Informations comptables
  soldeActuel: {
    type: Number,
    default: 0
  },
  decouvertAutorise: {
    type: Number,
    default: 0
  },
  montantForçageTotal: {
    type: Number,
    default: 0
  },

  // Workflow et statut
  statut: {
    type: String,
    enum: Object.values(STATUTS_DEMANDE),
    default: STATUTS_DEMANDE.BROUILLON
    // RETIRÉ: index: true - Défini plus bas dans les index composites
  },
  dateSoumission: Date,
  dateValidation: Date,
  dateDecaissement: Date,
  dateRegularisation: Date,
  dateAnnulation: Date,
  dateEcheance: {
    type: Date,
    required: true
  },

  // Validation hiérarchique
  validePar_conseiller: {
    userId: Schema.Types.ObjectId,
    date: Date,
    commentaire: String
  },
  validePar_rm: {
    userId: Schema.Types.ObjectId,
    date: Date,
    commentaire: String
  },
  validePar_dce: {
    userId: Schema.Types.ObjectId,
    date: Date,
    commentaire: String
  },
  validePar_adg: {
    userId: Schema.Types.ObjectId,
    date: Date,
    commentaire: String
  },

  // Documents
  piecesJustificatives: [PieceJustificativeSchema],
  commentaireInterne: String,
  commentaireTraitement: String,
  conditionsParticulieres: String,

  // Suivi
  regularisee: {
    type: Boolean,
    default: false
  },
  enRetard: {
    type: Boolean,
    default: false
  },

  // Historique complet
  historique: [HistoriqueEntrySchema]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI - PAS DE DÉFINITION D'INDEX DANS LES CHAMPS
DemandeForçageSchema.index({ numeroReference: 1 }, { unique: true }); // Index unique
DemandeForçageSchema.index({ clientId: 1, createdAt: -1 });
DemandeForçageSchema.index({ conseillerId: 1, statut: 1 });
DemandeForçageSchema.index({ agenceId: 1, createdAt: -1 });
DemandeForçageSchema.index({ statut: 1, dateEcheance: 1 });
DemandeForçageSchema.index({ createdAt: -1 });
DemandeForçageSchema.index({ montant: -1 });
DemandeForçageSchema.index({ dateEcheance: 1 }); // Pour les recherches par échéance
DemandeForçageSchema.index({ statut: 1, priorite: -1 }); // Pour le tri par priorité dans un statut

// Méthode statique pour générer le numéro de référence
DemandeForçageSchema.statics.generateNextReference = async function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `DF${year}${month}`;

  const lastDemande = await this.findOne({
    numeroReference: new RegExp(`^${prefix}`)
  }).sort({ numeroReference: -1 });

  let nextNumber = 1;
  if (lastDemande && lastDemande.numeroReference) {
    const lastNumber = parseInt(lastDemande.numeroReference.slice(-4));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

// Méthodes d'instance
DemandeForçageSchema.methods.calculateDaysRemaining = function () {
  if (!this.dateEcheance) return null;
  const now = new Date();
  const diffTime = this.dateEcheance - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

DemandeForçageSchema.methods.isUrgent = function () {
  const daysRemaining = this.calculateDaysRemaining();
  return this.priorite === 'URGENTE' || (daysRemaining !== null && daysRemaining <= 2);
};

DemandeForçageSchema.methods.canBeProcessedBy = function (user) {
  // Logique de permission selon le rôle et le statut
  const userRole = user.role;
  const currentStatus = this.statut;

  switch (userRole) {
    case 'client':
      return currentStatus === STATUTS_DEMANDE.BROUILLON &&
        this.clientId.toString() === user.id.toString();

    case 'conseiller':
      return [STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER, STATUTS_DEMANDE.EN_ETUDE_CONSEILLER].includes(currentStatus) &&
        (this.conseillerId?.toString() === user.id.toString() || user.agence === this.agenceId);

    case 'rm':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_RM &&
        user.agence === this.agenceId;

    case 'dce':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_DCE &&
        user.region === this.agenceId;

    case 'adg':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_ADG;

    case 'risques':
      return currentStatus === STATUTS_DEMANDE.EN_ANALYSE_RISQUES;

    case 'admin':
    case 'dga':
      return true;

    default:
      return false;
  }
};

DemandeForçageSchema.methods.addHistoryEntry = function (action, userId, commentaire = '') {
  const entry = {
    action,
    statutAvant: this.statut,
    statutApres: this.statut,
    userId,
    commentaire,
    timestamp: new Date()
  };

  this.historique.push(entry);
  return this;
};

// Méthodes statiques
DemandeForçageSchema.statics.findEnRetard = function () {
  const now = new Date();
  return this.find({
    dateEcheance: { $lt: now },
    statut: {
      $nin: [
        STATUTS_DEMANDE.REGULARISEE,
        STATUTS_DEMANDE.REJETEE,
        STATUTS_DEMANDE.ANNULEE,
        STATUTS_DEMANDE.DECAISSEE
      ]
    },
    enRetard: false
  });
};

DemandeForçageSchema.statics.getStatsByPeriod = function (startDate, endDate, agenceId = null) {
  const match = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (agenceId) {
    match.agenceId = agenceId;
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        count: { $sum: 1 },
        totalMontant: { $sum: "$montant" },
        validees: {
          $sum: { $cond: [{ $in: ["$statut", ["APPROUVEE", "DECAISSEE"]] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Virtuals
DemandeForçageSchema.virtual('joursRestants').get(function () {
  return this.calculateDaysRemaining();
});

DemandeForçageSchema.virtual('estExpiree').get(function () {
  const daysRemaining = this.calculateDaysRemaining();
  return daysRemaining !== null && daysRemaining < 0;
});

module.exports = mongoose.model('DemandeForçage', DemandeForçageSchema);