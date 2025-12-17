// ============================================
// 1. MODEL - models/DemandeForçage.js
// ============================================
const mongoose = require('mongoose');

// ✅ NETTOYER LE CACHE MONGOOSE COMPLÈTEMENT
delete mongoose.connection.models['DemandeForçage'];
delete mongoose.models.DemandeForçage;

// ✅ Sous-schéma explicite pour les pièces justificatives
const pieceJustificativeSchema = new mongoose.Schema({
  nom: String,
  url: String,
  type: String,
  taille: Number,
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const demandeForçageSchema = new mongoose.Schema({
  numeroReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  compteNumero: {
    type: String,
    required: true
  },
  typeOperation: {
    type: String,
    enum: ['VIREMENT', 'PRELEVEMENT', 'CHEQUE', 'CARTE', 'RETRAIT', 'AUTRE'],
    required: true
  },
  montant: {
    type: Number,
    required: true,
    min: 0
  },
  motif: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 500
  },
  soldeActuel: Number,
  decouvertAutorise: Number,
  montantForçageTotal: Number,
  statut: {
    type: String,
    enum: ['BROUILLON', 'ENVOYEE', 'EN_ETUDE', 'EN_VALIDATION', 'VALIDEE', 'REFUSEE', 'ANNULEE'],
    default: 'BROUILLON'
  },
  conseillerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  responsableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dateTraitement: Date,
  commentaireTraitement: String,
  montantAutorise: Number,
  dateEcheance: Date,
  conditionsParticulieres: String,
  
  // ✅ UTILISER LE SOUS-SCHÉMA
  piecesJustificatives: [pieceJustificativeSchema],
  
  dateRegularisation: Date,
  regularisee: {
    type: Boolean,
    default: false
  },
  scoreRisque: {
    type: String,
    enum: ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'],
    default: 'MOYEN'
  },
  notationClient: String,
  historique: [{
    action: String,
    statutAvant: String,
    statutApres: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commentaire: String,
    timestamp: { type: Date, default: Date.now }
  }],
  agenceId: String,
  priorite: {
    type: String,
    enum: ['NORMALE', 'URGENTE'],
    default: 'NORMALE'
  },
  compteDebit: String,
  devise: { type: String, default: 'XAF' },
  commentaireInterne: String,
  classification: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
demandeForçageSchema.index({ clientId: 1, statut: 1 });
demandeForçageSchema.index({ conseillerId: 1, statut: 1 });
demandeForçageSchema.index({ createdAt: -1 });

// Virtual
demandeForçageSchema.virtual('enRetard').get(function() {
  if (this.statut === 'VALIDEE' && this.dateEcheance && !this.regularisee) {
    return new Date() > this.dateEcheance;
  }
  return false;
});

// Méthode
demandeForçageSchema.methods.ajouterHistorique = function(action, userId, commentaire = '') {
  this.historique.push({
    action,
    statutAvant: this.statut,
    statutApres: this.statut,
    userId,
    commentaire
  });
};

// ✅ Export simple
const DemandeForçage = mongoose.model("DemandeForçage", demandeForçageSchema);

//module.exports = DemandeForçage;

module.exports =
  mongoose.models.DemandeForçage ||
  mongoose.model("DemandeForçage", demandeForçageSchema);

