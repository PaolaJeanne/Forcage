// src/models/DemandeForçage.js - VERSION MISE À JOUR COMPLÈTE
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');
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

// Schéma principal - AJOUT DES CHAMPS CLIENT
const DemandeForçageSchema = new Schema({
  // Références
  numeroReference: {
    type: String,
    required: true
  },
  
  // Référence au client
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // INFORMATIONS CLIENT STOCKÉES DIRECTEMENT (pour éviter les jointures)
  clientNom: {
    type: String,
    trim: true,
    index: true
  },
  clientPrenom: {
    type: String,
    trim: true,
    index: true
  },
  clientEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  clientTelephone: {
    type: String,
    trim: true
  },
  clientCni: {
    type: String,
    trim: true
  },
  clientNumeroCompte: {
    type: String,
    uppercase: true,
    trim: true
  },
  clientAgence: {
    type: String,
    trim: true
  },
  
  // Références autres
  conseillerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ============ AGENCE (CORRIGÉ) ============
  agencyId: {
    type: Schema.Types.ObjectId,
    ref: 'Agency',
    required: false, // Optionnel pour les clients
    index: true
  },
  agencyName: {
    type: String,
    trim: true
  },

  // ============ ASSIGNATION (NOUVEAU) ============
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedAt: Date,
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
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

// ============================================
// TOUS LES INDEX
// ============================================
DemandeForçageSchema.index({ numeroReference: 1 }, { unique: true });
DemandeForçageSchema.index({ clientId: 1, createdAt: -1 });
DemandeForçageSchema.index({ conseillerId: 1, statut: 1 });
DemandeForçageSchema.index({ agenceId: 1, createdAt: -1 });
DemandeForçageSchema.index({ statut: 1, dateEcheance: 1 });
DemandeForçageSchema.index({ createdAt: -1 });
DemandeForçageSchema.index({ montant: -1 });
DemandeForçageSchema.index({ dateEcheance: 1 });
DemandeForçageSchema.index({ statut: 1, priorite: -1 });
DemandeForçageSchema.index({ clientNom: 1, clientPrenom: 1 });
DemandeForçageSchema.index({ clientEmail: 1 });

// ============================================
// MIDDLEWARES
// ============================================

// Middleware pour récupérer les infos client avant sauvegarde
DemandeForçageSchema.pre('save', async function () {
  try {
    // Si clientId est modifié ou si les infos client sont manquantes
    if ((this.isModified('clientId') || !this.clientNom) && this.clientId) {
      const User = mongoose.model('User');
      const client = await User.findById(this.clientId).select('nom prenom email telephone cni numeroCompte agence');
      
      if (client) {
        this.clientNom = client.nom;
        this.clientPrenom = client.prenom;
        this.clientEmail = client.email;
        this.clientTelephone = client.telephone;
        this.clientCni = client.cni; // ✅ AJOUTÉ
        this.clientNumeroCompte = client.numeroCompte; // ✅ AJOUTÉ
        this.clientAgence = client.agence; // ✅ AJOUTÉ
        console.log(`✅ Infos client mises à jour pour la demande: ${client.prenom} ${client.nom}`);
      } else {
        console.warn(`⚠️ Client non trouvé avec ID: ${this.clientId}`);
      }
    }
    
    // Générer le numéro de référence si vide
    if (!this.numeroReference || this.isNew) {
      this.numeroReference = await this.constructor.generateNextReference();
    }
  } catch (error) {
    console.error('❌ Erreur dans pre-save middleware:', error);
    throw error;
  }
});

// Middleware pour les updates (findOneAndUpdate)
DemandeForçageSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  
  // Si clientId est modifié dans l'update
  if (update.clientId) {
    try {
      const User = mongoose.model('User');
      const client = await User.findById(update.clientId).select('nom prenom email telephone cni numeroCompte agence');
      
      if (client) {
        update.clientNom = client.nom;
        update.clientPrenom = client.prenom;
        update.clientEmail = client.email;
        update.clientTelephone = client.telephone;
        update.clientCni = client.cni; // ✅ AJOUTÉ
        update.clientNumeroCompte = client.numeroCompte; // ✅ AJOUTÉ
        update.clientAgence = client.agence; // ✅ AJOUTÉ
        this.setUpdate(update);
      }
    } catch (error) {
      console.error('Erreur récupération client:', error);
    }
  }
});

// ============================================
// VIRTUALS
// ============================================

// Virtual pour accéder au client complet
DemandeForçageSchema.virtual('client', {
  ref: 'User',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true
});

// Virtual pour le nom complet du client
DemandeForçageSchema.virtual('clientNomComplet').get(function () {
  if (this.clientNom && this.clientPrenom) {
    return `${this.clientPrenom} ${this.clientNom}`;
  }
  if (this.client && this.client.nom && this.client.prenom) {
    return `${this.client.prenom} ${this.client.nom}`;
  }
  return this.clientNom || 'Client';
});

// Virtual pour le conseiller
DemandeForçageSchema.virtual('conseiller', {
  ref: 'User',
  localField: 'conseillerId',
  foreignField: '_id',
  justOne: true
});

// Virtuals pour les calculs
DemandeForçageSchema.virtual('joursRestants').get(function () {
  return this.calculateDaysRemaining();
});

DemandeForçageSchema.virtual('estExpiree').get(function () {
  const daysRemaining = this.calculateDaysRemaining();
  return daysRemaining !== null && daysRemaining < 0;
});

// ============================================
// MÉTHODES D'INSTANCE
// ============================================

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
  const userRole = user.role;
  const currentStatus = this.statut;

  switch (userRole) {
    case 'client':
      return currentStatus === STATUTS_DEMANDE.BROUILLON &&
        this.clientId.toString() === user.id.toString();

    case 'conseiller':
      return [STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER, STATUTS_DEMANDE.EN_ETUDE_CONSEILLER].includes(currentStatus) &&
        (this.conseillerId?.toString() === user.id.toString() || this.agencyId?.toString() === user.agencyId?.toString());

    case 'rm':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_RM &&
        this.agencyId?.toString() === user.agencyId?.toString();

    case 'dce':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_DCE &&
        this.agencyId?.toString() === user.agencyId?.toString();

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

// ✅ NOUVEAU: Méthode pour vérifier si un utilisateur peut traiter la demande
DemandeForçageSchema.methods.canBeProcessedBy = function (user) {
  const userRole = user.role;
  const currentStatus = this.statut;

  switch (userRole) {
    case 'client':
      return currentStatus === STATUTS_DEMANDE.BROUILLON &&
        this.clientId.toString() === user.id.toString();

    case 'conseiller':
      return [STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER, STATUTS_DEMANDE.EN_ETUDE_CONSEILLER].includes(currentStatus) &&
        (this.conseillerId?.toString() === user.id.toString() || 
         this.agencyId?.toString() === user.agencyId?.toString());

    case 'rm':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_RM &&
        this.agencyId?.toString() === user.agencyId?.toString();

    case 'dce':
      return currentStatus === STATUTS_DEMANDE.EN_ATTENTE_DCE &&
        this.agencyId?.toString() === user.agencyId?.toString();

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

// ============================================
// MÉTHODES STATIQUES
// ============================================

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

// Méthode pour trouver les demandes en retard
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

// Méthode pour les statistiques par période
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

// Méthode pour récupérer les demandes avec population
DemandeForçageSchema.statics.findWithClient = function(query = {}, options = {}) {
  const defaultOptions = {
    limit: 10,
    sort: '-createdAt',
    populate: [
      {
        path: 'clientId',
        select: 'nom prenom email telephone role agence',
        model: 'User'
      },
      {
        path: 'conseillerId',
        select: 'nom prenom email agence',
        model: 'User'
      }
    ]
  };

  const finalOptions = { ...defaultOptions, ...options };
  
  return this.find(query)
    .populate(finalOptions.populate)
    .sort(finalOptions.sort)
    .limit(finalOptions.limit);
};

// ============================================
// MÉTHODE TOJSON POUR FORMATER LA RÉPONSE
// ============================================
DemandeForçageSchema.methods.toJSON = function () {
  const demande = this.toObject();
  
  // Ajouter le nom client formaté
  demande.nomClient = this.clientNomComplet;
  
  // Calculer les jours restants
  demande.joursRestants = this.calculateDaysRemaining();
  demande.estUrgente = this.isUrgent();
  
  return demande;
};

// ============================================
// PLUGIN DE PAGINATION
// ============================================
DemandeForçageSchema.plugin(mongoosePaginate);

// ============================================
// EXPORT
// ============================================
const DemandeForçage = mongoose.model('DemandeForçage', DemandeForçageSchema);

module.exports = DemandeForçage;