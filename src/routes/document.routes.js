const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { uploadMultiple } = require('../middlewares/upload.middleware');

// Upload de pièces justificatives (max 5 fichiers)
router.post(
  '/demandes/:id/pieces-justificatives',
  authenticate,
  uploadMultiple('piecesJustificatives', 5),
  documentController.uploadPiecesJustificatives
);

// Lister les pièces justificatives
router.get(
  '/demandes/:id/pieces-justificatives',
  authenticate,
  documentController.listerPiecesJustificatives
);

// Télécharger une pièce justificative
router.get(
  '/demandes/:id/pieces-justificatives/:fichierIndex',
  authenticate,
  documentController.telechargerPieceJustificative
);

// Supprimer une pièce justificative
router.delete(
  '/demandes/:id/pieces-justificatives/:fichierIndex',
  authenticate,
  documentController.supprimerPieceJustificative
);

module.exports = router;