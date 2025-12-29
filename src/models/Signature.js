// src/models/Signature.js
const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  // Demande associée
  demandeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemandeForçage',
    required: true,
    index: true
  },
  
  // Signataire
  signataire: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    nom: String,
    prenom: String,
    email: String,
    role: String
  },
  
  // Type de signature
  typeSignature: {
    type: String,
    enum: ['manuel', 'electronique', 'otp'],
    default: 'electronique'
  },
  
  // Données de signature
  signatureData: {
    // Hash du document signé
    documentHash: {
      type: String,
      required: true
    },
    
    // Signature cryptographique
    signatureCrypto: {
      type: String,
      required: true
    },
    
    // Image de signature (base64) - optionnel
    signatureImage: String,
    
    // Code OTP utilisé (si applicable)
    otpCode: String,
    
    // Certificat numérique
    certificat: String
  },
  
  // Métadonnées de traçabilité
  metadata: {
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  
  // Statut de validité
  valide: {
    type: Boolean,
    default: true
  },
  
  // Si invalidée
  invalidePar: {
    userId: mongoose.Schema.Types.ObjectId,
    raison: String,
    date: Date
  }
  
}, {
  timestamps: true
});

// Index composé pour recherche rapide
signatureSchema.index({ demandeId: 1, 'signataire.userId': 1 });
signatureSchema.index({ 'metadata.timestamp': -1 });
signatureSchema.index({ valide: 1 });

module.exports = mongoose.model('Signature', signatureSchema);