const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    enum: ['creation', 'modification', 'suppression', 'consultation', 'validation', 'refus']
  },
  entite: {
    type: String,
    required: true,
    enum: ['demande', 'utilisateur', 'document', 'parametres']
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

// Index pour les requêtes d'audit
auditLogSchema.index({ utilisateur: 1, createdAt: -1 });
auditLogSchema.index({ entite: 1, entiteId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;