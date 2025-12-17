// src/models/AuditLog.js - VERSION PERMISSIVE
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true
    // SUPPRIMEZ L'ENUM ou ajoutez toutes les actions possibles
    // enum: ['creation', 'modification', 'suppression', 'consultation', 
    //        'validation', 'refus', 'soumission', 'annulation',
    //        'traitement', 'remontee', 'regularisation']
  },
  entite: {
    type: String,
    required: true
    // SUPPRIMEZ L'ENUM
    // enum: ['demande', 'utilisateur', 'document', 'parametres']
  },
  entiteId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Index
auditLogSchema.index({ utilisateur: 1, createdAt: -1 });
auditLogSchema.index({ entite: 1, entiteId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;