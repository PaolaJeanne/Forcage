// src/models/NotificationTemplate.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
    // RETIRÉ: index: true - Défini plus bas
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
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI
notificationTemplateSchema.index({ code: 1 }, { unique: true }); // Index unique
notificationTemplateSchema.index({ code: 1, actif: 1 }); // Recherche par code et statut
notificationTemplateSchema.index({ categorie: 1 }); // Recherche par catégorie
notificationTemplateSchema.index({ type: 1 }); // Recherche par type
notificationTemplateSchema.index({ actif: 1 }); // Recherche par statut actif
notificationTemplateSchema.index({ 'destinataireRoles': 1 }); // Recherche par rôle destinataire
notificationTemplateSchema.index({ createdAt: -1 }); // Tri par date de création
notificationTemplateSchema.index({ priorite: 1 }); // Recherche par priorité

// Méthode pour remplacer les variables dans un template
notificationTemplateSchema.methods.genererNotification = function(variables = {}) {
  let titre = this.titreTemplate;
  let message = this.messageTemplate;
  
  // Remplacer les variables {{variable}} dans le titre et le message
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    titre = titre.replace(regex, value);
    message = message.replace(regex, value);
  }
  
  // Vérifier s'il reste des variables non remplacées
  const missingVariables = [...new Set([...titre.match(/{{(.*?)}}/g) || [], ...message.match(/{{(.*?)}}/g) || []])];
  
  return {
    titre,
    message,
    type: this.type,
    categorie: this.categorie,
    priorite: this.priorite,
    metadata: {
      templateCode: this.code,
      missingVariables: missingVariables.map(v => v.replace(/{{|}}/g, '')),
      variablesUsed: Object.keys(variables)
    }
  };
};

// Méthode statique pour trouver un template par code
notificationTemplateSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), actif: true });
};

// Méthode statique pour trouver tous les templates d'une catégorie
notificationTemplateSchema.statics.findByCategory = function(categorie) {
  return this.find({ categorie, actif: true }).sort({ nom: 1 });
};

// Méthode statique pour trouver les templates pour un rôle
notificationTemplateSchema.statics.findByRole = function(role) {
  return this.find({ 
    actif: true,
    $or: [
      { destinataireRoles: { $size: 0 } }, // Templates sans restriction de rôle
      { destinataireRoles: role } // Templates spécifiques au rôle
    ]
  }).sort({ categorie: 1, nom: 1 });
};

// Méthode statique pour désactiver un template
notificationTemplateSchema.statics.deactivate = async function(code) {
  return this.findOneAndUpdate(
    { code: code.toUpperCase() },
    { $set: { actif: false } },
    { new: true }
  );
};

// Méthode statique pour réactiver un template
notificationTemplateSchema.statics.activate = async function(code) {
  return this.findOneAndUpdate(
    { code: code.toUpperCase() },
    { $set: { actif: true } },
    { new: true }
  );
};

// Virtual pour lister les variables requises dans le template
notificationTemplateSchema.virtual('variablesRequises').get(function() {
  const titreVars = [...new Set((this.titreTemplate.match(/{{(.*?)}}/g) || []).map(v => v.replace(/{{|}}/g, '')))];
  const messageVars = [...new Set((this.messageTemplate.match(/{{(.*?)}}/g) || []).map(v => v.replace(/{{|}}/g, '')))];
  
  return [...new Set([...titreVars, ...messageVars])];
});

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);