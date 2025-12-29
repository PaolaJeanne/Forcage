// src/models/SMSLog.js
const mongoose = require('mongoose');

const SMSLogSchema = new mongoose.Schema({
  // Destinataire
  to: {
    type: String,
    required: true,
    index: true
  },
  
  // Expéditeur
  from: {
    type: String,
    default: process.env.SMS_SENDER_NAME || 'FORCAGE_BANK'
  },
  
  // Contenu du message
  message: {
    type: String,
    required: true
  },
  
  // Template utilisé
  templateCode: {
    type: String,
    index: true
  },
  
  // Variables utilisées
  variables: {
    type: Map,
    of: String,
    default: {}
  },
  
  // Provider utilisé
  provider: {
    type: String,
    enum: ['orange', 'twilio', 'africas_talking', 'bulksms'],
    required: true
  },
  
  // Statut d'envoi
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'unknown'],
    default: 'pending'
  },
  
  // ID du message chez le provider
  providerMessageId: String,
  
  // Coût (si disponible)
  cost: Number,
  
  // Métadonnées du provider
  providerMetadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Tentatives
  attempts: {
    type: Number,
    default: 1
  },
  
  // Erreur (si échec)
  error: String,
  
  // Délai de livraison (en secondes)
  deliveryTime: Number,
  
  // Balises pour segmentation
  tags: [String],
  
  // Référence à une demande
  demandeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemandeForçage',
    index: true
  },
  
  // Référence à un utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Dates
  sentAt: Date,
  deliveredAt: Date,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour les recherches fréquentes
SMSLogSchema.index({ status: 1, createdAt: -1 });
SMSLogSchema.index({ to: 1, createdAt: -1 });
SMSLogSchema.index({ demandeId: 1, createdAt: -1 });

module.exports = mongoose.model('SMSLog', SMSLogSchema);