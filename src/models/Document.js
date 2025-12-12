const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  demande: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemandeForçage',
    required: true
  },
  uploadePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nomFichier: {
    type: String,
    required: true
  },
  nomOriginal: {
    type: String,
    required: true
  },
  typeFichier: {
    type: String,
    required: true
  },
  tailleFichier: {
    type: Number,
    required: true
  },
  chemin: {
    type: String,
    required: true
  },
  typeDocument: {
    type: String,
    enum: ['justificatif_identite', 'justificatif_domicile', 'justificatif_revenus', 'autre'],
    default: 'autre'
  },
  statut: {
    type: String,
    enum: ['en_attente', 'valide', 'rejete'],
    default: 'en_attente'
  }
}, {
  timestamps: true
});

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;