// backend/models/User.js - VERSION COMPLÈTE
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants/roles');

const userSchema = new mongoose.Schema({
  // === INFORMATIONS DE BASE ===
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    required: true,
    default: 'client'
  },

  // === INFORMATIONS PERSONNELLES ===
  nom: {
    type: String,
    required: true
  },
  prenom: {
    type: String,
    required: true
  },
  telephone: {
    type: String,
    required: false
  },
  dateNaissance: {
    type: Date
  },
  lieuNaissance: {
    type: String
  },
  nationalite: {
    type: String,
    default: 'Camerounaise'
  },
  genre: {
    type: String,
    enum: ['Masculin', 'Féminin', 'Autre', '']
  },
  situationMatrimoniale: {
    type: String,
    enum: ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)', '']
  },

  // === DOCUMENTS D'IDENTITÉ ===
  numeroCNI: {
    type: String,
    index: true
  },
  dateDelivranceCNI: {
    type: Date
  },
  dateExpirationCNI: {
    type: Date
  },
  lieuDelivranceCNI: {
    type: String
  },

  // === ADRESSE ===
  adresse: {
    rue: String,
    quartier: String,
    ville: String,
    codePostal: String,
    pays: {
      type: String,
      default: 'Cameroun'
    }
  },

  // === INFORMATIONS PROFESSIONNELLES ===
  profession: {
    type: String
  },
  employeur: {
    type: String
  },
  revenuMensuel: {
    type: Number,
    default: 0
  },
  secteurActivite: {
    type: String
  },
  statutEmploi: {
    type: String,
    enum: ['Employé', 'Indépendant', 'Chômeur', 'Retraité', 'Étudiant', '']
  },

  // === INFORMATIONS BANCAIRES ===
  numeroCompte: {
    type: String,
    unique: true,
    index: true
  },
  iban: {
    type: String
  },
  typeCompte: {
    type: String,
    enum: ['Compte Courant', 'Compte Épargne', 'Compte Jeune', 'Compte Professionnel', '']
  },
  dateOuvertureCompte: {
    type: Date,
    default: Date.now
  },
  sourceFonds: {
    type: String
  },
  objectifCompte: {
    type: String
  },

  // === CONTACT D'URGENCE ===
  contactUrgence: {
    nom: String,
    telephone: String,
    lien: String
  },

  // === AGENCE & RÉFÉRENCES ===
  agence: {
    type: String
  },
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency'
  },
  conseillerAssigné: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // === DOCUMENTS FOURNIS ===
  documentsFournis: {
    cni: {
      type: Boolean,
      default: false
    },
    justificatifDomicile: {
      type: Boolean,
      default: false
    },
    photo: {
      type: Boolean,
      default: false
    },
    attestationTravail: {
      type: Boolean,
      default: false
    }
  },

  // === SCORE & NOTATION ===
  scoreCredit: {
    type: Number,
    default: 500
  },
  classification: {
    type: String,
    enum: ['normal', 'premium', 'business', 'jeune'],
    default: 'normal'
  },
  notationClient: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E'],
    default: 'C'
  },

  // === SÉCURITÉ & CONFORMITÉ ===
  kycValide: {
    type: Boolean,
    default: false
  },
  dateKyc: {
    type: Date
  },
  listeSMP: {
    type: Boolean,
    default: false
  },

  // === SOLDE ET LIMITES ===
  soldeActuel: {
    type: Number,
    default: 0
  },
  decouvertAutorise: {
    type: Number,
    default: 0
  },
  limiteAutorisation: {
    type: Number,
    default: 0
  },

  // === STATUT ET SÉCURITÉ ===
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  requiresPasswordChange: {
    type: Boolean,
    default: false
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },

  // === HISTORIQUE ===
  passwordHistory: [{
    password: String,
    changedAt: Date,
    reason: String,
    temporary: Boolean
  }],
  historiqueTransactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],

  // === COMPTEURS ===
  nombreTransactions: {
    type: Number,
    default: 0
  },
  montantTotalTransactions: {
    type: Number,
    default: 0
  },

  // === MÉTADONNÉES ===
  metadataSecurite: {
    dernierChangementMdp: Date,
    tentativeConnexion: Number,
    bloque: Boolean,
    mfaActive: Boolean,
    appareilsAutorises: [String]
  },
  preferencesCommunication: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    notificationsApp: { type: Boolean, default: true },
    newsletter: { type: Boolean, default: false }
  },

  // === TAGS ET NOTES ===
  tags: [String],
  notesInternes: String,

  // === CRÉATION ET MODIFICATION ===
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // === TIMESTAMPS ===
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ agence: 1 });
userSchema.index({ agencyId: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ notationClient: 1 });
userSchema.index({ classification: 1 });
userSchema.index({ kycValide: 1 });

// === MIDDLEWARES ===

// Hash du mot de passe avant sauvegarde
userSchema.pre('save', async function () {
  // Seulement si le mot de passe a été modifié
  if (!this.isModified('password')) {
    this.updatedAt = new Date();
    return;
  }

  // Vérifier la longueur minimale
  if (this.password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères');
  }

  // Hasher le mot de passe
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  // Ajouter à l'historique
  if (this.passwordHistory) {
    this.passwordHistory.push({
      password: this.password,
      changedAt: new Date(),
      reason: 'Changement de mot de passe',
      temporary: false
    });

    // Garder seulement les 5 derniers mots de passe
    if (this.passwordHistory.length > 5) {
      this.passwordHistory = this.passwordHistory.slice(-5);
    }
  }

  // Mettre à jour la date
  this.updatedAt = new Date();
});

// === MÉTHODES D'INSTANCE ===

// Comparer le mot de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Mettre à jour le profil
userSchema.methods.updateProfile = async function (updates) {
  const allowedFields = [
    'nom', 'prenom', 'telephone', 'genre', 'situationMatrimoniale',
    'adresse', 'profession', 'employeur', 'revenuMensuel',
    'contactUrgence', 'preferencesCommunication'
  ];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      this[field] = updates[field];
    }
  });

  this.updatedAt = new Date();
  return await this.save();
};

// Soumettre le KYC
userSchema.methods.submitKYC = async function (kycData) {
  const kycFields = [
    'numeroCNI', 'dateNaissance', 'lieuNaissance', 'nationalite', 'genre',
    'situationMatrimoniale', 'adresse', 'profession', 'employeur',
    'revenuMensuel', 'secteurActivite', 'statutEmploi', 'numeroCompte',
    'iban', 'typeCompte', 'contactUrgence', 'documentsFournis'
  ];

  kycFields.forEach(field => {
    if (kycData[field] !== undefined) {
      this[field] = kycData[field];
    }
  });

  this.kycValide = true;
  this.dateKyc = new Date();
  this.updatedAt = new Date();

  return await this.save();
};

// Vérifier si le KYC est complet
userSchema.methods.isKYCComplete = function () {
  const requiredFields = [
    'numeroCNI', 'dateNaissance', 'lieuNaissance', 'genre',
    'situationMatrimoniale', 'adresse.rue', 'adresse.ville',
    'profession', 'employeur', 'revenuMensuel', 'numeroCompte'
  ];

  for (const field of requiredFields) {
    const value = this.get(field);
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return false;
    }
  }

  return this.documentsFournis.cni && 
         this.documentsFournis.justificatifDomicile && 
         this.documentsFournis.photo;
};

// Calculer le score de crédit
userSchema.methods.calculateCreditScore = function () {
  let score = 500; // Score de base

  // Âge (18-65)
  if (this.dateNaissance) {
    const age = new Date().getFullYear() - new Date(this.dateNaissance).getFullYear();
    if (age >= 25 && age <= 50) score += 50;
    if (age < 25 || age > 60) score -= 30;
  }

  // Revenu mensuel
  if (this.revenuMensuel) {
    if (this.revenuMensuel > 500000) score += 100;
    else if (this.revenuMensuel > 200000) score += 50;
    else if (this.revenuMensuel < 50000) score -= 50;
  }

  // Notation client
  const notationScores = { 'A': 100, 'B': 50, 'C': 0, 'D': -50, 'E': -100 };
  if (this.notationClient) score += notationScores[this.notationClient] || 0;

  // KYC validé
  if (this.kycValide) score += 50;

  // Pas dans la liste SMP
  if (!this.listeSMP) score += 100;

  // Limiter le score entre 300 et 850
  return Math.min(Math.max(score, 300), 850);
};

// === MÉTHODES STATIQUES ===

// Trouver par email avec sélection du mot de passe
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email });
};

// Générer un numéro de compte unique
userSchema.statics.generateAccountNumber = async function () {
  const prefix = 'CM';
  let uniqueFound = false;
  let accountNumber;

  while (!uniqueFound) {
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    accountNumber = `${prefix}${randomNum}`;

    const existing = await this.findOne({ numeroCompte: accountNumber });
    if (!existing) {
      uniqueFound = true;
    }
  }

  return accountNumber;
};

// Vérifier la disponibilité du CNI
userSchema.statics.checkCNIAvailability = async function (cniNumber) {
  const existing = await this.findOne({ numeroCNI: cniNumber });
  return !existing;
};

// Trouver les clients par agence
userSchema.statics.findClientsByAgency = function (agencyId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({
    role: 'client',
    agencyId: agencyId,
    isActive: true
  })
  .skip(skip)
  .limit(limit)
  .select('-password -passwordHistory')
  .populate('conseillerAssigné', 'nom prenom email telephone')
  .sort({ createdAt: -1 });
};

// Statistiques d'agence
userSchema.statics.getAgencyStats = async function (agencyId) {
  const stats = await this.aggregate([
    {
      $match: {
        agencyId: mongoose.Types.ObjectId(agencyId),
        isActive: true
      }
    },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        totalSolde: { $sum: '$soldeActuel' },
        averageCreditScore: { $avg: '$scoreCredit' }
      }
    },
    {
      $group: {
        _id: null,
        totalClients: {
          $sum: {
            $cond: [{ $eq: ['$_id', 'client'] }, '$count', 0]
          }
        },
        totalStaff: {
          $sum: {
            $cond: [{ $ne: ['$_id', 'client'] }, '$count', 0]
          }
        },
        totalSolde: { $sum: '$totalSolde' },
        roles: {
          $push: {
            role: '$_id',
            count: '$count',
            totalSolde: '$totalSolde',
            averageCreditScore: '$averageCreditScore'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalClients: 1,
        totalStaff: 1,
        totalSolde: 1,
        roles: {
          $filter: {
            input: '$roles',
            as: 'role',
            cond: { $ne: ['$$role.role', null] }
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalClients: 0,
    totalStaff: 0,
    totalSolde: 0,
    roles: []
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;