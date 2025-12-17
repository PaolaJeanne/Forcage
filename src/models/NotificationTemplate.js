// src/models/NotificationTemplate.js
const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  nom: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'urgent'],
    default: 'info'
  },
  categorie: {
    type: String,
    enum: ['demande', 'user', 'system', 'audit'],
    required: true
  },
  
  // Templates avec variables {{variable}}
  titreTemplate: {
    type: String,
    required: true
  },
  messageTemplate: {
    type: String,
    required: true
  },
  
  // Configuration
  destinataireRoles: [String], // ['client', 'conseiller', 'rm']
  
  priorite: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale'
  },
  
  actif: {
    type: Boolean,
    default: true
  },
  
  // Exemples pour la documentation
  exempleVariables: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
  
}, { timestamps: true });

// Index
notificationTemplateSchema.index({ code: 1, actif: 1 });
notificationTemplateSchema.index({ categorie: 1 });

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);