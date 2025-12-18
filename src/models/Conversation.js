// src/models/Conversation.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  readBy: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    readAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  _id: false
});

const conversationSchema = new mongoose.Schema({
  // Participants de la conversation
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  
  // Type de conversation
  type: {
    type: String,
    enum: ['support', 'direct', 'group', 'demande'],
    default: 'support'
  },
  
  // Référence à la demande (si liée à une demande)
  demandeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemandeForçage'
  },
  
  // Titre de la conversation
  title: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  // Dernier message (pour les prévisualisations)
  lastMessage: messageSchema,
  
  // Nombre de messages non lus par utilisateur
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Statut d'archivage
  isArchived: {
    type: Boolean,
    default: false
  },
  
  // Qui a archivé la conversation et quand
  archivedBy: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    archivedAt: Date,
    reason: String
  }],
  
  // Image/avatar de la conversation (pour les groupes)
  avatar: {
    type: String,
    default: null
  },
  
  // Description (pour les groupes)
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Créateur de la conversation
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Paramètres de la conversation
  settings: {
    allowNewParticipants: {
      type: Boolean,
      default: true
    },
    onlyAdminsCanPost: {
      type: Boolean,
      default: false
    },
    muteNotifications: {
      type: Boolean,
      default: false
    }
  },
  
  // Tags pour organiser/catégoriser
  tags: [{
    type: String,
    trim: true
  }],
  
  // Métadonnées supplémentaires
  metadata: {
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    department: String,
    project: String,
    customFields: mongoose.Schema.Types.Mixed
  },
  
  // Date de la dernière activité
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  
  // Participants qui ont quitté la conversation
  leftParticipants: [{
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    leftAt: Date,
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ⚠️ RETIREZ LES INDEX EN DOUBLE (cause du warning)
// Supprimez ces lignes si vous avez déjà "index: true" dans les champs :
// conversationSchema.index({ participants: 1, lastActivityAt: -1 });
// conversationSchema.index({ 'lastMessage.createdAt': -1 });
// conversationSchema.index({ demandeId: 1, type: 1 });
// conversationSchema.index({ type: 1, isArchived: 1 });
// conversationSchema.index({ tags: 1 });
// conversationSchema.index({ 'metadata.priority': 1 });

// Virtual pour le nombre total de messages
conversationSchema.virtual('messageCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId',
  count: true
});

// Virtual pour les participants actifs
conversationSchema.virtual('activeParticipants', {
  ref: 'User',
  localField: 'participants',
  foreignField: '_id',
  justOne: false
});

// ⭐⭐⭐ CORRECTION CRITIQUE - LIGNE 204 ⭐⭐⭐
conversationSchema.pre('save', function(next) {
  if (this.isModified('lastMessage') && this.lastMessage) {
    this.lastActivityAt = new Date();
  }
  
  // ✅ CORRECTION : Vérifier si next existe avant de l'appeler
  if (typeof next === 'function') {
    next();
  }
});

// Méthode pour ajouter un participant
conversationSchema.methods.addParticipant = async function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    await this.save();
  }
  return this;
};

// Méthode pour retirer un participant
conversationSchema.methods.removeParticipant = async function(userId) {
  const index = this.participants.indexOf(userId);
  if (index > -1) {
    this.participants.splice(index, 1);
    
    // Ajouter à leftParticipants
    this.leftParticipants.push({
      userId,
      leftAt: new Date()
    });
    
    await this.save();
  }
  return this;
};

// Méthode pour archiver
conversationSchema.methods.archive = async function(userId, reason = '') {
  this.isArchived = true;
  this.archivedBy.push({
    userId,
    archivedAt: new Date(),
    reason
  });
  await this.save();
  return this;
};

// Méthode pour désarchiver
conversationSchema.methods.unarchive = async function(userId) {
  this.isArchived = false;
  this.archivedBy = this.archivedBy.filter(archive => 
    archive.userId.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Méthode pour incrémenter le compteur de messages non lus
conversationSchema.methods.incrementUnreadCount = async function(excludeUserId = null) {
  this.participants.forEach(participantId => {
    if (!excludeUserId || participantId.toString() !== excludeUserId.toString()) {
      const currentCount = this.unreadCount.get(participantId.toString()) || 0;
      this.unreadCount.set(participantId.toString(), currentCount + 1);
    }
  });
  await this.save();
  return this;
};

// Méthode pour réinitialiser les messages non lus
conversationSchema.methods.resetUnreadCount = async function(userId) {
  this.unreadCount.set(userId.toString(), 0);
  await this.save();
  return this;
};

// Méthode pour vérifier si un utilisateur est participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.toString() === userId.toString());
};

// Méthode pour obtenir les autres participants
conversationSchema.methods.getOtherParticipants = function(userId) {
  return this.participants.filter(p => p.toString() !== userId.toString());
};

// Méthode pour générer un titre automatique
conversationSchema.methods.generateTitle = async function() {
  const User = mongoose.model('User');
  const participants = await User.find({
    _id: { $in: this.participants }
  }).select('nom prenom'); // ⚠️ Correction: prenum -> prenom
  
  if (participants.length === 2) {
    this.title = `${participants[0].prenom} ${participants[0].nom} - ${participants[1].prenom} ${participants[1].nom}`;
  } else if (participants.length > 2) {
    const firstTwo = participants.slice(0, 2);
    this.title = `Groupe: ${firstTwo.map(p => p.prenom).join(', ')} + ${participants.length - 2}`;
  } else {
    this.title = 'Conversation';
  }
  
  await this.save();
  return this.title;
};

// Méthode statique pour trouver les conversations d'un utilisateur
conversationSchema.statics.findByUserId = function(userId, options = {}) {
  const {
    archived = false,
    type,
    limit = 50,
    skip = 0,
    sort = { lastActivityAt: -1 }
  } = options;
  
  const query = {
    participants: userId,
    isArchived: archived
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('participants', 'nom prenom email role avatar')
    .populate('demandeId', 'numeroReference statut')
    .populate('createdBy', 'nom prenom avatar');
};

// Méthode statique pour trouver ou créer une conversation directe
conversationSchema.statics.findOrCreateDirect = async function(userId1, userId2) {
  // Vérifier que les deux utilisateurs existent
  const User = mongoose.model('User');
  const [user1, user2] = await Promise.all([
    User.findById(userId1),
    User.findById(userId2)
  ]);
  
  if (!user1 || !user2) {
    throw new Error('Un ou plusieurs utilisateurs non trouvés');
  }
  
  // Chercher une conversation existante
  let conversation = await this.findOne({
    participants: { $all: [userId1, userId2], $size: 2 },
    type: 'direct',
    isArchived: false
  });
  
  // Si pas trouvée, en créer une nouvelle
  if (!conversation) {
    conversation = await this.create({
      participants: [userId1, userId2],
      type: 'direct',
      title: `${user1.prenom} ${user1.nom} - ${user2.prenom} ${user2.nom}`,
      createdBy: userId1
    });
  }
  
  return conversation;
};

// Méthode statique pour trouver ou créer une conversation de demande
conversationSchema.statics.findOrCreateDemande = async function(demandeId, userId) {
  const DemandeForçage = mongoose.model('DemandeForçage');
  const demande = await DemandeForçage.findById(demandeId)
    .populate('clientId')
    .populate('conseillerId');
  
  if (!demande) {
    throw new Error('Demande non trouvée');
  }
  
  // Participants de base
  const baseParticipants = [demande.clientId._id, demande.conseillerId._id];
  
  // Ajouter l'utilisateur s'il n'est pas déjà dedans
  if (!baseParticipants.some(p => p.toString() === userId.toString())) {
    baseParticipants.push(userId);
  }
  
  // Chercher une conversation existante
  let conversation = await this.findOne({
    demandeId,
    type: 'demande',
    isArchived: false
  });
  
  // Si pas trouvée, en créer une nouvelle
  if (!conversation) {
    conversation = await this.create({
      participants: baseParticipants,
      type: 'demande',
      demandeId,
      title: `Demande #${demande.numeroReference}`,
      createdBy: userId,
      metadata: {
        priority: 'high',
        department: 'support'
      }
    });
  }
  
  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;