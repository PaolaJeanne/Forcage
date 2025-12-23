const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Référence à l'utilisateur
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Type de notification - CORRIGÉ
  type: {
    type: String,
    enum: [
      // Notifications générales
      'info', 
      'warning', 
      'success', 
      'error', 
      'urgent', 
      'system',
      
      // Notifications spécifiques aux demandes
      'demande_creation',
      'demande_soumission',
      'demande_modification',
      'demande_annulation',
      'demande_assignee',
      'demande_statut',
      'demande_remontee',
      'demande_approuvee',
      'demande_rejetee',
      'demande_regularisation',
      'demande_echeance',
      'demande_retour',
      
      // Notifications chat
      'message',
      'conversation',
      'mention',
      
      // Notifications documents
      'document_upload',
      'document_validation',
      'document_rejet',
      
      // Notifications tâches
      'tache_assignee',
      'tache_terminee',
      'tache_retard'
    ],
    default: 'info'
  },
  
  // Titre et message
  titre: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // **SYSTÈME UNIVERSEL :** Support pour TOUTES les entités
  entite: {
    type: String,
    enum: [
      'message',          // Messages de chat
      'conversation',     // Conversations
      'demande',          // Demandes de forçage
      'document',         // Documents
      'tache',           // Tâches
      'evenement',       // Événements calendrier
      'systeme',         // Notifications système
      'alerte',          // Alertes
      'rapport',         // Rapports
      'user',            // Autres utilisateurs
      'groupe',          // Groupes
      'commentaire',     // Commentaires
      'reaction',        // Réactions
      'mention',         // Mentions
      'validation',      // Validations
      'rejet',           // Rejets
      'attribution',     // Attributions
      'echeance',        // Échéances
      'reminder',        // Rappels
      'other'            // Autres
    ],
    required: true,
    index: true
  },
  
  // ID de l'entité (peut être ObjectId ou String)
  entiteId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    index: true
  },
  
  // Action à effectuer
  action: {
    type: String,
    enum: [
      'view',        // Visualiser
      'edit',        // Modifier
      'validate',    // Valider
      'reject',      // Rejeter
      'comment',     // Commenter
      'assign',      // Assigner
      'complete',    // Compléter
      'archive',     // Archiver
      'delete',      // Supprimer
      'download',    // Télécharger
      'share',       // Partager
      'respond',     // Répondre
      'acknowledge', // Accuser réception
      'none'         // Aucune action
    ],
    default: 'view'
  },
  
  // Lien direct vers l'élément
  lien: {
    type: String,
    default: null
  },
  
  // État de la notification
  lue: {
    type: Boolean,
    default: false,
    index: true
  },
  
  lueAt: {
    type: Date,
    default: null
  },
  
  // **MÉTADONNÉES FLEXIBLES** pour toutes les entités
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  // Priorité
  priorite: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente', 'critique'],
    default: 'normale',
    index: true
  },
  
  // Catégorie pour le filtrage
  categorie: {
    type: String,
    enum: [
      'chat',
      'demande',
      'document',
      'tache',
      'calendrier',
      'system',
      'alerte',
      'rapport',
      'equipe',
      'client',
      'validation',
      'finance',
      'rh',
      'other'
    ],
    default: 'other',
    index: true
  },
  
  // Source de la notification
  source: {
    type: String,
    enum: ['system', 'user', 'automated', 'external', 'api'],
    default: 'system'
  },
  
  // Utilisateur qui a déclenché la notification (si applicable)
  declencheur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Date d'expiration
  expiresAt: {
    type: Date,
    index: true,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
  },
  
  // Pour les notifications récurrentes
  recurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'none'
  },
  
  // Tags pour la recherche
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composés
notificationSchema.index({ utilisateur: 1, lue: 1, createdAt: -1 });
notificationSchema.index({ utilisateur: 1, categorie: 1, lue: 1 });
notificationSchema.index({ utilisateur: 1, entite: 1, entiteId: 1 });
notificationSchema.index({ priorite: 1, createdAt: -1 });
notificationSchema.index({ tags: 1 });

// Méthode pour marquer comme lu
notificationSchema.methods.marquerCommeLue = async function() {
  this.lue = true;
  this.lueAt = new Date();
  await this.save();
  return this;
};

// Méthode pour obtenir le lien de l'entité
notificationSchema.methods.getEntityLink = function() {
  if (this.lien) return this.lien;
  
  const baseUrl = process.env.FRONTEND_URL || '';
  const routes = {
    message: `/chat/messages/${this.entiteId}`,
    conversation: `/chat/conversations/${this.entiteId}`,
    demande: `/demandes/${this.entiteId}`,
    document: `/documents/${this.entiteId}`,
    tache: `/taches/${this.entiteId}`,
    evenement: `/calendrier/${this.entiteId}`,
    user: `/utilisateurs/${this.entiteId}`,
    rapport: `/rapports/${this.entiteId}`
  };
  
  return routes[this.entite] ? `${baseUrl}${routes[this.entite]}` : null;
};

// Méthode pour formater pour l'API
notificationSchema.methods.toAPIFormat = function() {
  const notification = this.toObject();
  
  // Ajouter des données virtuelles
  notification.lienComplet = this.getEntityLink();
  notification.estExpiree = this.expiresAt && new Date() > this.expiresAt;
  
  // Formatage du temps écoulé
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) notification.tempsEcoule = 'À l\'instant';
  else if (diffMins < 60) notification.tempsEcoule = `Il y a ${diffMins} min`;
  else if (diffHours < 24) notification.tempsEcoule = `Il y a ${diffHours} h`;
  else if (diffDays < 7) notification.tempsEcoule = `Il y a ${diffDays} j`;
  else notification.tempsEcoule = this.createdAt.toLocaleDateString('fr-FR');
  
  return notification;
};

// Méthodes statiques
notificationSchema.statics.marquerToutesCommeLues = async function(userId) {
  return this.updateMany(
    { utilisateur: userId, lue: false },
    { $set: { lue: true, lueAt: new Date() } }
  );
};

notificationSchema.statics.compterNonLues = async function(userId, filters = {}) {
  const query = { utilisateur: userId, lue: false };
  
  if (filters.categorie) query.categorie = filters.categorie;
  if (filters.entite) query.entite = filters.entite;
  if (filters.priorite) query.priorite = filters.priorite;
  
  return this.countDocuments(query);
};

notificationSchema.statics.nettoyerExpirees = async function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
    priorite: { $ne: 'critique' }
  });
};

// Virtual pour les données de l'entité
notificationSchema.virtual('donneesEntite', {
  ref: function() {
    const modelMap = {
      message: 'Message',
      conversation: 'Conversation',
      demande: 'DemandeForçage',
      document: 'Document',
      tache: 'Tache',
      evenement: 'Evenement',
      user: 'User'
    };
    
    return modelMap[this.entite];
  },
  localField: 'entiteId',
  foreignField: '_id',
  justOne: true
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;