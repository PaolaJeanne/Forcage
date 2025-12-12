const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
  role: {
    type: String,
    enum: ['client', 'conseiller', 'responsable', 'admin'],
    default: 'client'
  },
  telephone: {
    type: String,
    trim: true
  },
  numeroCompte: {
    type: String,
    trim: true
  },
  agence: {
    type: String,
    trim: true
  },
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
  }
}, {
  timestamps: true
});

// Hash du mot de passe avant la sauvegarde - VERSION ASYNC/AWAIT
userSchema.pre('save', async function() {
  // Si le mot de passe n'a pas été modifié, on passe à la suite
  if (!this.isModified('password')) {
    return;
  }
  
  // Hash le mot de passe
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour obtenir les infos publiques sans mot de passe
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.otpSecret;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;