// src/models/Message.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'document', 'video', 'audio', 'archive', 'other'],
    default: 'other'
  },
  size: {
    type: Number, // en octets
    default: 0
  },
  mimeType: String,
  thumbnail: String, // URL de la miniature pour les images/vidéos
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

const messageSchema = new mongoose.Schema({
  // Référence à la conversation
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
    // RETIRÉ: index: true - Défini plus bas
  },
  
  // Expéditeur du message
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // RETIRÉ: index: true - Défini plus bas
  },
  
  // Contenu du message
  content: {
    type: String,
    required: function() {
      return !this.attachments || this.attachments.length === 0;
    },
    trim: true,
    maxlength: 10000
  },
  
  // Type de message
  type: {
    type: String,
    enum: ['text', 'file', 'system', 'notification', 'action'],
    default: 'text'
    // RETIRÉ: index: true - Défini plus bas
  },
  
  // Pièces jointes
  attachments: [attachmentSchema],
  
  // Qui a lu le message
  readBy: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    readAt: { 
      type: Date, 
      default: Date.now 
    },
    deviceId: String // Pour le multi-device
  }],
  
  // Qui a supprimé le message
  deletedBy: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    deletedAt: { 
      type: Date, 
      default: Date.now 
    },
    reason: String
  }],
  
  // Informations d'édition
  edited: {
    isEdited: { 
      type: Boolean, 
      default: false 
    },
    editedAt: Date,
    previousContent: String,
    editHistory: [{
      content: String,
      editedAt: Date
    }]
  },
  
  // Message auquel on répond
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Mentions dans le message
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Réactions au message
  reactions: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    emoji: String,
    reactedAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  
  // Message épinglé
  pinned: {
    isPinned: { 
      type: Boolean, 
      default: false 
    },
    pinnedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    pinnedAt: Date,
    pinnedReason: String
  },
  
  // Métadonnées
  metadata: {
    // Pour les messages système
    systemType: String,
    systemData: mongoose.Schema.Types.Mixed,
    
    // Pour les notifications
    notificationType: String,
    notificationData: mongoose.Schema.Types.Mixed,
    
    // Pour les actions
    actionType: String,
    actionData: mongoose.Schema.Types.Mixed,
    
    // Informations de l'appareil
    deviceInfo: {
      platform: String,
      browser: String,
      ipAddress: String
    },
    
    // Informations de localisation
    location: {
      coordinates: [Number], // [longitude, latitude]
      placeName: String
    },
    
    // Autres métadonnées personnalisées
    customFields: mongoose.Schema.Types.Mixed
  },
  
  // Statut de livraison
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
    // RETIRÉ: index: true - Défini plus bas
  },
  
  // Message temporaire (comme "message en cours d'envoi")
  temporaryId: String,
  
  // Pour la modération
  moderated: {
    isModerated: { 
      type: Boolean, 
      default: false 
    },
    moderatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    moderatedAt: Date,
    moderationReason: String
  },
  
  // Flags pour le contenu
  flags: [{
    flaggedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    flagType: String,
    flaggedAt: Date,
    reason: String
  }],
  
  // Version du message (pour l'édition)
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// TOUS LES INDEX DÉFINIS ICI - CENTRALISÉS
messageSchema.index({ conversationId: 1, createdAt: -1 }); // Pour les conversations
messageSchema.index({ sender: 1, createdAt: -1 }); // Pour les messages d'un expéditeur
messageSchema.index({ conversationId: 1 }); // Recherche simple par conversation
messageSchema.index({ createdAt: -1 }); // Tri global
messageSchema.index({ type: 1 }); // Recherche par type de message
messageSchema.index({ status: 1 }); // Recherche par statut
messageSchema.index({ 'mentions': 1 }); // Recherche par mentions
messageSchema.index({ 'reactions.userId': 1 }); // Recherche par réactions
messageSchema.index({ 'metadata.systemType': 1 }); // Recherche par type système
messageSchema.index({ 'pinned.isPinned': 1 }); // Recherche des messages épinglés
messageSchema.index({ 'deletedBy.userId': 1 }); // Recherche par suppression
messageSchema.index({ temporaryId: 1 }); // Recherche par ID temporaire
messageSchema.index({ replyTo: 1 }); // Recherche par réponse
messageSchema.index({ 'metadata.deviceInfo.ipAddress': 1 }); // Recherche par IP

// Virtual pour la conversation
messageSchema.virtual('conversation', {
  ref: 'Conversation',
  localField: 'conversationId',
  foreignField: '_id',
  justOne: true
});

// Middleware pour mettre à jour le statut
messageSchema.pre('save', function(next) {
  // Si le message est marqué comme supprimé, mettre à jour le contenu
  if (this.deletedBy.length > 0 && this.content !== '[Message supprimé]') {
    this.content = '[Message supprimé]';
    this.attachments = [];
  }
  
  // ✅ CORRECTION : Vérifier si next existe
  if (typeof next === 'function') {
    next();
  }
});

// Méthode pour marquer comme lu
messageSchema.methods.markAsRead = async function(userId, deviceId = null) {
  const alreadyRead = this.readBy.some(r => r.userId.toString() === userId.toString());
  
  if (!alreadyRead) {
    this.readBy.push({
      userId,
      readAt: new Date(),
      deviceId
    });
    
    // Mettre à jour le statut
    if (this.readBy.length >= 2) { // Au moins 2 personnes (expéditeur + lecteur)
      this.status = 'read';
    } else {
      this.status = 'delivered';
    }
    
    await this.save();
  }
  
  return this;
};

// Méthode pour ajouter une réaction
messageSchema.methods.addReaction = async function(userId, emoji) {
  // Retirer l'ancienne réaction de l'utilisateur s'il en a une
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  
  // Ajouter la nouvelle réaction
  this.reactions.push({
    userId,
    emoji,
    reactedAt: new Date()
  });
  
  await this.save();
  return this;
};

// Méthode pour retirer une réaction
messageSchema.methods.removeReaction = async function(userId) {
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  await this.save();
  return this;
};

// Méthode pour épingler le message
messageSchema.methods.pin = async function(userId, reason = '') {
  this.pinned = {
    isPinned: true,
    pinnedBy: userId,
    pinnedAt: new Date(),
    pinnedReason: reason
  };
  
  await this.save();
  return this;
};

// Méthode pour désépingler le message
messageSchema.methods.unpin = async function() {
  this.pinned = {
    isPinned: false,
    pinnedBy: null,
    pinnedAt: null,
    pinnedReason: null
  };
  
  await this.save();
  return this;
};

// Méthode pour éditer le message
messageSchema.methods.edit = async function(newContent, userId) {
  // Sauvegarder l'ancien contenu dans l'historique
  if (!this.edited.editHistory) {
    this.edited.editHistory = [];
  }
  
  this.edited.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  // Limiter l'historique à 10 versions
  if (this.edited.editHistory.length > 10) {
    this.edited.editHistory = this.edited.editHistory.slice(-10);
  }
  
  // Mettre à jour le message
  this.edited = {
    isEdited: true,
    editedAt: new Date(),
    previousContent: this.content,
    editHistory: this.edited.editHistory
  };
  
  this.content = newContent;
  this.version += 1;
  
  // Ajouter une mention d'édition dans les métadonnées
  this.metadata = this.metadata || {};
  this.metadata.lastEditedBy = userId;
  
  await this.save();
  return this;
};

// Méthode pour supprimer le message
messageSchema.methods.softDelete = async function(userId, reason = '') {
  this.deletedBy.push({
    userId,
    deletedAt: new Date(),
    reason
  });
  
  // Si l'utilisateur n'est pas l'expéditeur, garder une trace
  if (this.sender.toString() !== userId.toString()) {
    this.metadata = this.metadata || {};
    this.metadata.deletedByAdmin = {
      adminId: userId,
      originalContent: this.content,
      deletedAt: new Date(),
      reason
    };
  }
  
  this.content = '[Message supprimé]';
  this.attachments = [];
  
  await this.save();
  return this;
};

// Méthode pour restaurer un message supprimé
messageSchema.methods.restore = async function(userId) {
  // Vérifier si l'utilisateur a les permissions
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  const isAdmin = user && ['admin', 'dga'].includes(user.role);
  
  if (!isAdmin && this.sender.toString() !== userId.toString()) {
    throw new Error('Non autorisé à restaurer ce message');
  }
  
  // Retirer l'utilisateur de deletedBy
  this.deletedBy = this.deletedBy.filter(d => d.userId.toString() !== userId.toString());
  
  // Restaurer le contenu original si disponible
  if (this.metadata?.deletedByAdmin?.originalContent) {
    this.content = this.metadata.deletedByAdmin.originalContent;
    delete this.metadata.deletedByAdmin;
  }
  
  await this.save();
  return this;
};

// Méthode pour flagger le message
messageSchema.methods.flag = async function(userId, flagType, reason = '') {
  this.flags.push({
    flaggedBy: userId,
    flagType,
    flaggedAt: new Date(),
    reason
  });
  
  await this.save();
  return this;
};

// Méthode pour vérifier si le message est supprimé pour un utilisateur
messageSchema.methods.isDeletedForUser = function(userId) {
  return this.deletedBy.some(d => d.userId.toString() === userId.toString());
};

// Méthode pour vérifier si le message est lu par un utilisateur
messageSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(r => r.userId.toString() === userId.toString());
};

// Méthode pour obtenir les infos de lecture
messageSchema.methods.getReadInfo = function() {
  return {
    totalRead: this.readBy.length,
    readBy: this.readBy.map(r => ({
      userId: r.userId,
      readAt: r.readAt,
      deviceId: r.deviceId
    })),
    lastReadAt: this.readBy.length > 0 
      ? new Date(Math.max(...this.readBy.map(r => r.readAt.getTime())))
      : null
  };
};

// Méthode statique pour trouver les messages d'une conversation
messageSchema.statics.findByConversation = function(conversationId, options = {}) {
  const {
    before = null,
    after = null,
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 },
    includeDeleted = false,
    userId = null // Pour filtrer les messages supprimés pour cet utilisateur
  } = options;
  
  let query = { conversationId };
  
  // Filtrer par date
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }
  if (after) {
    query.createdAt = { ...query.createdAt, $gt: new Date(after) };
  }
  
  // Exclure les messages supprimés pour l'utilisateur
  if (userId && !includeDeleted) {
    query['deletedBy.userId'] = { $ne: userId };
  }
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('sender', 'nom prenum email role avatar')
    .populate({
      path: 'replyTo',
      select: 'content sender createdAt',
      populate: {
        path: 'sender',
        select: 'nom prenum avatar'
      }
    })
    .populate('mentions', 'nom prenum avatar');
};

// Méthode statique pour trouver les messages non lus d'un utilisateur
messageSchema.statics.findUnreadByUser = function(userId, conversationId = null) {
  const query = {
    'readBy.userId': { $ne: userId },
    sender: { $ne: userId },
    'deletedBy.userId': { $ne: userId }
  };
  
  if (conversationId) {
    query.conversationId = conversationId;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('sender', 'nom prenum avatar')
    .populate('conversationId', 'title participants');
};

// Méthode statique pour compter les messages non lus
messageSchema.statics.countUnreadByUser = function(userId, conversationId = null) {
  const query = {
    'readBy.userId': { $ne: userId },
    sender: { $ne: userId },
    'deletedBy.userId': { $ne: userId }
  };
  
  if (conversationId) {
    query.conversationId = conversationId;
  }
  
  return this.countDocuments(query);
};

// Méthode statique pour créer un message système
messageSchema.statics.createSystemMessage = async function(conversationId, systemType, systemData) {
  const systemMessages = {
    conversation_created: '✅ Conversation créée',
    conversation_archived: '📁 Conversation archivée',
    conversation_unarchived: '📂 Conversation désarchivée',
    user_joined: '👤 Nouveau participant ajouté',
    user_left: '👋 Participant retiré',
    user_mentioned: '🔔 Mention dans le message',
    demande_attached: '📋 Demande attachée',
    file_uploaded: '📎 Fichier téléchargé',
    message_pinned: '📌 Message épinglé',
    message_edited: '✏️ Message modifié'
  };
  
  const message = await this.create({
    conversationId,
    sender: null,
    content: systemMessages[systemType] || 'Notification système',
    type: 'system',
    metadata: {
      systemType,
      systemData
    }
  });
  
  return message;
};

// Méthode statique pour nettoyer les messages temporaires
messageSchema.statics.cleanupTemporaryMessages = async function(olderThanHours = 1) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);
  
  const result = await this.deleteMany({
    temporaryId: { $exists: true },
    createdAt: { $lt: cutoffDate }
  });
  
  return result;
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;