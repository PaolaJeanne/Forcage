// ============================================
// 1. MODEL - models/DemandeForçage.js
// ============================================
const mongoose = require('mongoose');

const demandeForçageSchema = new mongoose.Schema({
  // Identification
  numeroReference: {
    type: String,
    required: true,
    unique: true,
    index: true  // Gardez cette ligne
  },
    
  // Client
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  compteNumero: {
    type: String,
    required: true
  },
  
  // Détails de l'opération
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
  
  // Informations complémentaires
  soldeActuel: Number,
  decouvertAutorise: Number,
  montantForçageTotal: Number, // Montant total en dépassement
  
  // Statut et workflow
  statut: {
    type: String,
    enum: ['BROUILLON', 'ENVOYEE', 'EN_ETUDE', 'EN_VALIDATION', 'VALIDEE', 'REFUSEE', 'ANNULEE'],
    default: 'BROUILLON'
  },
  
  // Traitement
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
  
  // Décision
  montantAutorise: Number,
  dateEcheance: Date, // J+15 par défaut
  conditionsParticulieres: String,
  
  // Pièces justificatives
  piecesJustificatives: [{
    nom: String,
    url: String,
    type: String,
    taille: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Régularisation
  dateRegularisation: Date,
  regularisee: {
    type: Boolean,
    default: false
  },
  
  // Scoring et risque
  scoreRisque: {
    type: String,
    enum: ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'],
    default: 'MOYEN'
  },
  notationClient: String,
  
  // Historique des actions
  historique: [{
    action: String,
    statutAvant: String,
    statutApres: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commentaire: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Métadonnées
  agenceId: String,
  priorite: {
    type: String,
    enum: ['NORMALE', 'URGENTE'],
    default: 'NORMALE'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes pour performance
demandeForçageSchema.index({ clientId: 1, statut: 1 });
demandeForçageSchema.index({ conseillerId: 1, statut: 1 });
//demandeForçageSchema.index({ numeroReference: 1 });
demandeForçageSchema.index({ createdAt: -1 });

// Virtual pour vérifier si en retard
demandeForçageSchema.virtual('enRetard').get(function() {
  if (this.statut === 'VALIDEE' && this.dateEcheance && !this.regularisee) {
    return new Date() > this.dateEcheance;
  }
  return false;
});

// Méthode pour ajouter une action à l'historique
demandeForçageSchema.methods.ajouterHistorique = function(action, userId, commentaire = '') {
  this.historique.push({
    action,
    statutAvant: this.statut,
    statutApres: this.statut,
    userId,
    commentaire
  });
};

module.exports =
  mongoose.models.DemandeForçage ||
  mongoose.model("DemandeForçage", demandeForçageSchema);

