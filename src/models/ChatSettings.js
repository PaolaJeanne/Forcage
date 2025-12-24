// src/models/ChatArchive.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const chatArchiveSchema = new mongoose.Schema({
  // Conversation archivée
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  
  // Données de la conversation
  conversationData: mongoose.Schema.Types.Mixed,
  
  // Messages archivés
  messages: [mongoose.Schema.Types.Mixed],
  
  // Participants au moment de l'archivage
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Raison de l'archivage
  reason: {
    type: String,
    enum: ['auto', 'manual', 'compliance', 'cleanup'],
    default: 'manual'
  },
  
  // Archivé par
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Date d'archivage
  archivedAt: {
    type: Date,
    default: Date.now
  },
  
  // Date d'expiration (pour l'archivage automatique)
  expiresAt: {
    type: Date
  },
  
  // Métadonnées
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

chatArchiveSchema.index({ conversationId: 1 }); // Pour les recherches par conversation
chatArchiveSchema.index({ archivedAt: -1 });    // Pour le tri par date d'archivage
chatArchiveSchema.index({ expiresAt: 1 });      // Pour le TTL (expiration automatique)
chatArchiveSchema.index({ archivedBy: 1 });     // Pour les recherches par archiveur
chatArchiveSchema.index({ reason: 1, archivedAt: -1 }); // Pour les statistiques
chatArchiveSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Pour le nettoyage automatique

// Méthode statique pour archiver une conversation
chatArchiveSchema.statics.archiveConversation = async function(conversationId, options = {}) {
  const Conversation = mongoose.model('Conversation');
  const Message = mongoose.model('Message');
  
  // Récupérer la conversation
  const conversation = await Conversation.findById(conversationId)
    .populate('participants')
    .populate('demandeId')
    .lean();
  
  if (!conversation) {
    throw new Error('Conversation non trouvée');
  }
  
  // Récupérer tous les messages
  const messages = await Message.find({ conversationId })
    .populate('sender', 'nom prenum')
    .populate('mentions', 'nom prenum')
    .lean();
  
  // Créer l'archive
  const archive = await this.create({
    conversationId,
    conversationData: conversation,
    messages,
    participants: conversation.participants.map(p => p._id),
    reason: options.reason || 'manual',
    archivedBy: options.archivedBy,
    expiresAt: options.expiresAt,
    metadata: options.metadata
  });
  
  // Supprimer la conversation et ses messages (optionnel)
  if (options.deleteOriginal !== false) {
    await Conversation.findByIdAndDelete(conversationId);
    await Message.deleteMany({ conversationId });
  }
  
  return archive;
};

const ChatArchive = mongoose.model('ChatArchive', chatArchiveSchema);

module.exports = ChatArchive;