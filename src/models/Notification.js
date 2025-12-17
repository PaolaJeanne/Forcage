// src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'urgent'], // ✅ Ajout 'urgent'
    default: 'info'
  },
  titre: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  entite: {
    type: String,
    default: null
  },
  entiteId: {
    type: mongoose.Schema.Types.Mixed, // ✅ Accepte ObjectId OU String
    default: null
  },
  lien: {
    type: String,
    default: null
  },
  lue: {
    type: Boolean,
    default: false,
    index: true
  },
  lueAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // ✅ NOUVEAU : Référence au template utilisé
  templateCode: {
    type: String,
    default: null
  },
  // ✅ NOUVEAU : Priorité
  priorite: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale'
  }
}, {
  timestamps: true
});

// Index
notificationSchema.index({ utilisateur: 1, lue: 1, createdAt: -1 });
notificationSchema.index({ templateCode: 1 });

module.exports = mongoose.model('Notification', notificationSchema);