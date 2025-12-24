// src/models/Metric.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    unique: true
  },
  valeur: {
    type: Number,
    required: true
  },
  unite: {
    type: String,
    default: null
  },
  tendance: {
    type: String,
    enum: ['up', 'down', 'stable', null],
    default: null
  },
  variation: {
    type: Number,
    default: 0
  },
  periode: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'realtime'],
    default: 'realtime'
  },
  categorie: {
    type: String,
    enum: ['demande', 'client', 'risque', 'performance', 'financier'],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI
metricSchema.index({ nom: 1, categorie: 1, periode: 1 });
metricSchema.index({ createdAt: 1 });
metricSchema.index({ categorie: 1 });
metricSchema.index({ periode: 1 });
metricSchema.index({ createdAt: -1 });

// Méthodes d'instance
metricSchema.methods.updateValue = async function(newValue) {
  const oldValue = this.valeur;
  this.valeur = newValue;
  this.variation = newValue - oldValue;
  
  if (this.variation > 0) {
    this.tendance = 'up';
  } else if (this.variation < 0) {
    this.tendance = 'down';
  } else {
    this.tendance = 'stable';
  }
  
  await this.save();
  return this;
};

// Méthodes statiques
metricSchema.statics.findByCategory = function(categorie) {
  return this.find({ categorie })
    .sort({ nom: 1 })
    .lean();
};

metricSchema.statics.getLatestByPeriod = function(periode) {
  return this.find({ periode })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
};

metricSchema.statics.upsertMetric = async function(data) {
  const metric = await this.findOneAndUpdate(
    { nom: data.nom },
    { 
      $set: {
        valeur: data.valeur,
        unite: data.unite || null,
        variation: data.variation || 0,
        tendance: data.tendance || null,
        periode: data.periode || 'realtime',
        categorie: data.categorie,
        metadata: data.metadata || {}
      }
    },
    { 
      upsert: true, 
      new: true, 
      setDefaultsOnInsert: true 
    }
  );
  
  return metric;
};

const Metric = mongoose.model('Metric', metricSchema);

module.exports = Metric;