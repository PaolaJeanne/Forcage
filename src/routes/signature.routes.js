// ============================================
// src/routes/signature.routes.js
// ============================================
const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/signature.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent authentification
router.use(authenticate);

// Signer une demande
router.post('/demande/:demandeId/sign',
  signatureController.signerDemande
);

// Vérifier une signature (public - pas besoin de permission spéciale)
router.get('/:signatureId/verify',
  signatureController.verifierSignature
);

// Générer QR Code
router.get('/:signatureId/qrcode',
  signatureController.genererQRCode
);

// Lister signatures d'une demande
router.get('/demande/:demandeId',
  signatureController.listerSignatures
);

// Invalider signature (admin seulement)
router.delete('/:signatureId',
  signatureController.invaliderSignature
);

module.exports = router;