// src/models/Document.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  demande: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemandeForçage',
    required: true
  },
  uploadePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nomFichier: {
    type: String,
    required: true
  },
  nomOriginal: {
    type: String,
    required: true
  },
  typeFichier: {
    type: String,
    required: true
  },
  tailleFichier: {
    type: Number,
    required: true
  },
  chemin: {
    type: String,
    required: true
  },
  typeDocument: {
    type: String,
    enum: ['justificatif_identite', 'justificatif_domicile', 'justificatif_revenus', 'autre'],
    default: 'autre'
  },
  statut: {
    type: String,
    enum: ['en_attente', 'valide', 'rejete'],
    default: 'en_attente'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI
documentSchema.index({ demande: 1 });
documentSchema.index({ uploadePar: 1 });
documentSchema.index({ typeDocument: 1 });
documentSchema.index({ statut: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ demande: 1, typeDocument: 1 });
documentSchema.index({ demande: 1, statut: 1 });

// Méthodes d'instance
documentSchema.methods.marquerValide = async function() {
  this.statut = 'valide';
  await this.save();
  return this;
};

documentSchema.methods.marquerRejete = async function() {
  this.statut = 'rejete';
  await this.save();
  return this;
};

// Méthodes statiques
documentSchema.statics.findByDemande = function(demandeId, filters = {}) {
  const query = { demande: demandeId };
  
  if (filters.typeDocument) query.typeDocument = filters.typeDocument;
  if (filters.statut) query.statut = filters.statut;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('uploadePar', 'nom prenom email');
};

documentSchema.statics.findByUploader = function(uploaderId) {
  return this.find({ uploadePar: uploaderId })
    .sort({ createdAt: -1 })
    .populate('demande', 'numeroReference statut');
};

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;