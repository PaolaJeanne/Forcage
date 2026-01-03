// src/models/Agency.js - Modèle pour les agences
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AgencySchema = new Schema({
  // Identifiant unique
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },

  // Code d'agence (court, unique) - AJOUTÉ
  code: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    index: true,
    required: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{3,8}$/.test(v);
      },
      message: 'Le code doit contenir uniquement des lettres majuscules (3-8 caractères)'
    }
  },

  // Description
  description: {
    type: String,
    trim: true
  },

  // Localisation
  region: {
    type: String,
    trim: true
  },

  city: {
    type: String,
    trim: true
  },

  address: {
    type: String,
    trim: true
  },

  // Contact
  phone: {
    type: String,
    trim: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Responsables
  responsables: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['rm', 'dce', 'manager'],
      default: 'manager'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Conseillers assignés
  conseillers: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Statut
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composés
AgencySchema.index({ name: 1, isActive: 1 });
AgencySchema.index({ code: 1, isActive: 1 }); // AJOUTÉ
AgencySchema.index({ region: 1, isActive: 1 });

// Virtual pour le nombre de conseillers
AgencySchema.virtual('totalConseillers').get(function () {
  return this.conseillers ? this.conseillers.length : 0;
});

// Virtual pour le nombre de responsables
AgencySchema.virtual('totalResponsables').get(function () {
  return this.responsables ? this.responsables.length : 0;
});

// Méthode pour ajouter un conseiller
AgencySchema.methods.addConseiller = function (userId) {
  if (!this.conseillers.find(c => c.userId.toString() === userId.toString())) {
    this.conseillers.push({ userId });
  }
  return this;
};

// Méthode pour retirer un conseiller
AgencySchema.methods.removeConseiller = function (userId) {
  this.conseillers = this.conseillers.filter(c => c.userId.toString() !== userId.toString());
  return this;
};

// Méthode statique pour récupérer les agences d'un conseiller
AgencySchema.statics.findByConseiller = function (conseillerUserId) {
  return this.find({
    'conseillers.userId': conseillerUserId,
    isActive: true
  });
};

// Méthode statique pour récupérer toutes les agences actives
AgencySchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Méthode statique pour trouver par code - AJOUTÉ
AgencySchema.statics.findByCode = function (code) {
  return this.findOne({ 
    code: code.toUpperCase(),
    isActive: true 
  });
};

// Méthode pour générer un code automatique - AJOUTÉ
AgencySchema.statics.generateCode = function (name) {
  // Prend les 3 premières lettres du nom en majuscules
  const baseCode = name.substring(0, 3).toUpperCase();
  
  // Vérifie si le code existe déjà
  return this.findOne({ code: baseCode })
    .then(existing => {
      if (!existing) return baseCode;
      
      // Si existe, ajoute un numéro
      let counter = 1;
      const generateUnique = async () => {
        const newCode = baseCode + counter;
        const exists = await this.findOne({ code: newCode });
        if (!exists) return newCode;
        counter++;
        return generateUnique();
      };
      
      return generateUnique();
    });
};

module.exports = mongoose.model('Agency', AgencySchema);