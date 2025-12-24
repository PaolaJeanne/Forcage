// src/models/Report.js - VERSION AMÉLIORÉE
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom', 'audit', 'performance'],
    default: 'custom'
  },
  utilisateurId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  donnees: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  format: {
    type: String,
    enum: ['json', 'csv', 'pdf', 'excel'],
    default: 'json'
  },
  statut: {
    type: String,
    enum: ['en_cours', 'termine', 'erreur'],
    default: 'en_cours'
  },
  lienTelechargement: {
    type: String,
    default: null
  },
  parametres: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI
reportSchema.index({ utilisateurId: 1, createdAt: -1 });
reportSchema.index({ type: 1, createdAt: -1 });
reportSchema.index({ statut: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ type: 1, statut: 1 });

// Méthodes d'instance
reportSchema.methods.marquerTermine = async function(lienTelechargement = null) {
  this.statut = 'termine';
  if (lienTelechargement) {
    this.lienTelechargement = lienTelechargement;
  }
  await this.save();
  return this;
};

reportSchema.methods.marquerErreur = async function() {
  this.statut = 'erreur';
  await this.save();
  return this;
};

// Méthodes statiques
reportSchema.statics.findByUser = function(userId, options = {}) {
  const { type, statut, limit = 50, skip = 0 } = options;
  
  const query = { utilisateurId: userId };
  
  if (type) query.type = type;
  if (statut) query.statut = statut;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('utilisateurId', 'nom prenom email');
};

reportSchema.statics.createReport = async function(data) {
  const report = await this.create({
    titre: data.titre,
    type: data.type || 'custom',
    utilisateurId: data.utilisateurId,
    donnees: data.donnees || {},
    format: data.format || 'json',
    parametres: data.parametres || {}
  });
  
  return report;
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;