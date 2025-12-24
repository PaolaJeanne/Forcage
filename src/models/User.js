// src/models/User.js - VERSION CORRIGÉE
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },
  prenom: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    lowercase: true,
    trim: true
    // RETIRÉ: index: true - Défini plus bas
  },

  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: 6,
    select: false
  },

  // ============ GESTION DES RÔLES ============
  role: {
    type: String,
    enum: ['client', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'admin'],
    default: 'client',
    required: true
  },

  // Limites d'autorisation (pour conseillers et responsables)
  limiteAutorisation: {
    type: Number,
    default: function () {
      switch (this.role) {
        case 'conseiller': return 5000000;
        case 'rm': return 10000000;
        case 'dce': return 20000000;
        case 'adg': return 50000000;
        case 'dga': return 100000000;
        case 'admin': return Infinity;
        default: return 0;
      }
    }
  },

  // Informations métier
  telephone: {
    type: String,
    trim: true
  },
  numeroCompte: {
    type: String,
    uppercase: true,
    trim: true
    // RETIRÉ: index: true - Défini plus bas
  },
  agence: {
    type: String,
    trim: true,
    required: function () { return ['conseiller', 'rm', 'dce'].includes(this.role); }
  },

  // Classification client (si role = client)
  classification: {
    type: String,
    enum: ['normal', 'sensible', 'restructure', 'defaut'],
    default: 'normal'
  },

  // Informations financières (si client)
  soldeActuel: {
    type: Number,
    default: 0
  },
  decouvertAutorise: {
    type: Number,
    default: 0
  },

  // Scoring et notation
  notationClient: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E'],
    default: 'C'
  },

  // KYC
  kycValide: {
    type: Boolean,
    default: false
  },
  dateKyc: Date,

  // Liste spéciale (27 clients SMP)
  listeSMP: {
    type: Boolean,
    default: false
  },

  // Sécurité
  otpSecret: {
    type: String,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// TOUS LES INDEX DÉFINIS ICI - CENTRALISÉS
// ============================================
userSchema.index({ email: 1 }, { unique: true }); // Index unique sur email
userSchema.index({ role: 1, agence: 1 }); // Recherche par rôle et agence
userSchema.index({ numeroCompte: 1 }, { unique: true, sparse: true }); // Index unique sparse
userSchema.index({ isActive: 1 }); // Recherche par statut actif
userSchema.index({ createdAt: -1 }); // Tri par date de création
userSchema.index({ role: 1 }); // Recherche par rôle
userSchema.index({ agence: 1 }); // Recherche par agence
userSchema.index({ classification: 1 }); // Recherche par classification
userSchema.index({ notationClient: 1 }); // Recherche par notation
userSchema.index({ lastLogin: -1 }); // Tri par dernière connexion
userSchema.index({ nom: 1, prenom: 1 }); // Recherche par nom/prénom
userSchema.index({ 'fullName': 'text' }, {
  weights: { nom: 3, prenom: 2, email: 1 },
  name: 'UserSearchIndex'
}); // Index texte pour la recherche

// ============================================
// MIDDLEWARES
// ============================================

// Hash du mot de passe avant la sauvegarde
userSchema.pre('save', async function (next) {
  // Ne hacher que si le password est modifié
  if (!this.isModified('password')) {
    return nextIfExists(next);
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    nextIfExists(next);
  } catch (error) {
    nextIfExists(next, error);
  }
});

// Middleware pour les updates (findOneAndUpdate, findByIdAndUpdate)
userSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();

  if (update.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
      this.setUpdate(update);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Middleware pour formater les données avant sauvegarde
userSchema.pre('save', function (next) {
  // Formater l'email en lowercase
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }

  // Formater le numéro de compte en majuscules
  if (this.isModified('numeroCompte') && this.numeroCompte) {
    this.numeroCompte = this.numeroCompte.toUpperCase().trim();
  }

  // Nettoyer le téléphone
  if (this.isModified('telephone') && this.telephone) {
    this.telephone = this.telephone.replace(/\s/g, '');
  }

  nextIfExists(next);
});

// ============================================
// MÉTHODES D'INSTANCE
// ============================================

// Méthode pour comparer les mots de passe (bcryptjs)
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Méthode pour vérifier si peut autoriser un montant
userSchema.methods.peutAutoriser = function (montant) {
  if (['admin', 'adg', 'dga'].includes(this.role)) {
    return true;
  }
  return montant <= this.limiteAutorisation;
};

// Méthode pour obtenir le prochain niveau hiérarchique
userSchema.methods.getProchainNiveau = function () {
  const hierarchie = {
    'conseiller': 'rm',
    'rm': 'dce',
    'dce': 'adg',
    'adg': 'dga',
    'dga': null
  };
  return hierarchie[this.role] || null;
};

// Méthode pour activer/désactiver l'utilisateur
userSchema.methods.toggleActive = async function () {
  this.isActive = !this.isActive;
  return await this.save();
};

// Méthode pour vérifier les permissions
userSchema.methods.hasPermission = function (permission) {
  const permissions = {
    'client': ['view_own_demandes', 'create_demande', 'chat'],
    'conseiller': ['view_all_demandes', 'validate_demande', 'chat', 'assign_demande'],
    'rm': ['view_all_demandes', 'validate_demande', 'chat', 'escalate_demande'],
    'dce': ['view_all_demandes', 'validate_demande', 'manage_users'],
    'adg': ['view_all_demandes', 'final_validation', 'manage_users', 'audit'],
    'dga': ['all_permissions'],
    'admin': ['all_permissions'],
    'risques': ['view_all_demandes', 'risk_analysis', 'reject_demande']
  };

  const rolePermissions = permissions[this.role] || [];
  return rolePermissions.includes(permission) || rolePermissions.includes('all_permissions');
};

// ============================================
// VIRTUALS
// ============================================

// Méthode pour obtenir le nom complet
userSchema.virtual('fullName').get(function () {
  return `${this.prenom} ${this.nom}`;
});

userSchema.virtual('initials').get(function () {
  return `${this.prenom.charAt(0)}${this.nom.charAt(0)}`.toUpperCase();
});

userSchema.virtual('displayRole').get(function () {
  const roleNames = {
    'client': 'Client',
    'conseiller': 'Conseiller',
    'rm': 'Responsable Mission',
    'dce': 'Directeur Centre d\'Exploitation',
    'adg': 'Assistant Directeur Général',
    'dga': 'Directeur Général Adjoint',
    'admin': 'Administrateur',
    'risques': 'Gestionnaire Risques'
  };
  return roleNames[this.role] || this.role;
});

// ============================================
// MÉTHODES STATIQUES
// ============================================

// Trouver un utilisateur par email avec le mot de passe
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Vérifier si un email existe
userSchema.statics.emailExists = async function (email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// Vérifier si un numéro de compte existe
userSchema.statics.accountNumberExists = async function (numeroCompte) {
  const user = await this.findOne({ numeroCompte: numeroCompte.toUpperCase() });
  return !!user;
};

// Rechercher des utilisateurs par texte
userSchema.statics.search = function (searchTerm, filters = {}) {
  let query = {};

  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  if (filters.role) query.role = filters.role;
  if (filters.agence) query.agence = filters.agence;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;

  return this.find(query)
    .sort({ createdAt: -1 })
    .select('-password -otpSecret -__v');
};

// Compter les utilisateurs par rôle
userSchema.statics.countByRole = function () {
  return this.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// ============================================
// MÉTHODE TOJSON (masquer données sensibles)
// ============================================
userSchema.methods.toJSON = function () {
  const user = this.toObject();

  // Supprimer les données sensibles
  delete user.password;
  delete user.otpSecret;
  delete user.__v;

  return user;
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function nextIfExists(next, error = null) {
  if (next && typeof next === 'function') {
    if (error) {
      next(error);
    } else {
      next();
    }
  } else if (error) {
    throw error;
  }
}

// ============================================
// EXPORT
// ============================================
const User = mongoose.model('User', userSchema);

module.exports = User;