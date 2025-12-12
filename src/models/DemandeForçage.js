const mongoose = require('mongoose');

const demandeForçageSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  numeroCompte: {
    type: String,
    required: [true, 'Le numéro de compte est requis'],
    trim: true
  },
  typeOperation: {
    type: String,
    enum: ['virement', 'prelevement', 'cheque', 'carte', 'autre'],
    required: [true, 'Le type d\'opération est requis']
  },
  montant: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0, 'Le montant doit être positif']
  },
  motif: {
    type: String,
    required: [true, 'Le motif est requis'],
    minlength: 10,
    maxlength: 500
  },
  statut: {
    type: String,
    enum: ['en_attente', 'en_etude', 'en_validation', 'validee', 'refusee'],
    default: 'en_attente'
  },
  montantAutorise: {
    type: Number,
    default: 0
  },
  dateLimiteRegularisation: {
    type: Date
  },
  documentsJoints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  historique: [{
    statut: String,
    commentaire: String,
    traitePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  conseillerAssigne: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  niveauRisque: {
    type: String,
    enum: ['faible', 'moyen', 'eleve'],
    default: 'moyen'
  },
  kycValide: {
    type: Boolean,
    default: false
  },
  regularise: {
    type: Boolean,
    default: false
  },
  dateRegularisation: {
    type: Date
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
demandeForçageSchema.index({ client: 1, statut: 1 });
demandeForçageSchema.index({ conseillerAssigne: 1 });
demandeForçageSchema.index({ createdAt: -1 });

// Méthode pour ajouter une entrée à l'historique
demandeForçageSchema.methods.ajouterHistorique = function(statut, commentaire, userId) {
  this.historique.push({
    statut,
    commentaire,
    traitePar: userId,
    date: new Date()
  });
  this.statut = statut;
};

const DemandeForçage = mongoose.model('DemandeForçage', demandeForçageSchema);

module.exports = DemandeForçage;