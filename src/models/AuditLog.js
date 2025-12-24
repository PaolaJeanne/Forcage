// src/models/AuditLog.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true
  },
  entite: {
    type: String,
    required: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI
auditLogSchema.index({ utilisateur: 1, createdAt: -1 });
auditLogSchema.index({ entite: 1, entiteId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entite: 1, action: 1 });
auditLogSchema.index({ 'details.userId': 1 });

// Méthodes statiques
auditLogSchema.statics.log = async function(data) {
  const logEntry = await this.create({
    utilisateur: data.utilisateur,
    action: data.action,
    entite: data.entite,
    entiteId: data.entiteId,
    details: data.details || {},
    ipAddress: data.ipAddress,
    userAgent: data.userAgent
  });
  return logEntry;
};

auditLogSchema.statics.findByEntity = function(entite, entiteId) {
  return this.find({ entite, entiteId })
    .sort({ createdAt: -1 })
    .populate('utilisateur', 'nom prenom email role')
    .lean();
};

auditLogSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 100, skip = 0, startDate, endDate } = options;
  
  const query = { utilisateur: userId };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;