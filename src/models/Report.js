// src/models/Report.js - VERSION SIMPLE
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  titre: String,
  type: String,
  utilisateurId: mongoose.Schema.Types.ObjectId,
  donnees: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);