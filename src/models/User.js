// ============================================
// 1. MODEL USER COMPLET - src/models/User.js
// ============================================
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
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
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
    default: function() {
      switch(this.role) {
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
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true,
    required: function() { return this.role === 'client'; }
  },
  agence: {
    type: String,
    trim: true,
    required: function() { return ['conseiller', 'rm', 'dce'].includes(this.role); }
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
  timestamps: true
});

// ============================================
// INDEXES
// ============================================
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, agence: 1 });
userSchema.index({ numeroCompte: 1 }, { unique: true, sparse: true });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// ============================================
// MIDDLEWARES
// ============================================

// Hash du mot de passe avant la sauvegarde
userSchema.pre('save', async function(next) {
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
userSchema.pre('findOneAndUpdate', async function(next) {
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
userSchema.pre('save', function(next) {
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
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('❌ Erreur comparePassword:', error);
    return false;
  }
};

// Méthode pour vérifier si peut autoriser un montant
userSchema.methods.peutAutoriser = function(montant) {
  if (['admin', 'adg', 'dga'].includes(this.role)) {
    return true;
  }
  return montant <= this.limiteAutorisation;
};

// Méthode pour obtenir le prochain niveau hiérarchique
userSchema.methods.getProchainNiveau = function() {
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
userSchema.methods.toggleActive = async function() {
  this.isActive = !this.isActive;
  return await this.save();
};

// Méthode pour obtenir le nom complet
userSchema.virtual('fullName').get(function() {
  return `${this.prenom} ${this.nom}`;
});

// ============================================
// MÉTHODES STATIQUES
// ============================================

// Trouver un utilisateur par email avec le mot de passe
userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Vérifier si un email existe
userSchema.statics.emailExists = async function(email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// Vérifier si un numéro de compte existe
userSchema.statics.accountNumberExists = async function(numeroCompte) {
  const user = await this.findOne({ numeroCompte: numeroCompte.toUpperCase() });
  return !!user;
};

// ============================================
// MÉTHODE TOJSON (masquer données sensibles)
// ============================================
userSchema.methods.toJSON = function() {
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