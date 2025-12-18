// src/models/Metric.js - VERSION UNIQUE
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
  timestamps: true
});

// Index pour performances
metricSchema.index({ nom: 1, categorie: 1, periode: 1 });
metricSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Metric', metricSchema);