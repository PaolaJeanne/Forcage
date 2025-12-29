// ============================================
// src/controllers/signature.controller.js
// ============================================
const SignatureService = require('../services/signature.service');

class SignatureController {
  
  /**
   * Signer une demande
   * POST /api/v1/signatures/demande/:demandeId/sign
   */
  async signerDemande(req, res) {
    try {
      const { demandeId } = req.params;
      const userId = req.user.userId || req.user._id;
      
      console.log(`📝 [SIGNATURE CONTROLLER] Signature demande ${demandeId} par ${userId}`);
      
      const options = {
        typeSignature: req.body.typeSignature || 'electronique',
        signatureImage: req.body.signatureImage,
        otpCode: req.body.otpCode,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      
      const signature = await SignatureService.signerDemande(
        demandeId,
        userId,
        options
      );
      
      res.status(201).json({
        success: true,
        message: 'Demande signée avec succès',
        data: {
          signatureId: signature._id,
          documentHash: signature.signatureData.documentHash,
          timestamp: signature.metadata.timestamp,
          signataire: signature.signataire
        }
      });
      
    } catch (error) {
      console.error('❌ [SIGNATURE CONTROLLER] Erreur:', error);
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Vérifier une signature
   * GET /api/v1/signatures/:signatureId/verify
   */
  async verifierSignature(req, res) {
    try {
      const { signatureId } = req.params;
      
      console.log(`🔍 [SIGNATURE CONTROLLER] Vérification signature ${signatureId}`);
      
      const verification = await SignatureService.verifierSignature(signatureId);
      
      res.json({
        success: true,
        data: verification
      });
      
    } catch (error) {
      console.error('❌ [SIGNATURE CONTROLLER] Erreur vérification:', error);
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Générer QR Code de vérification
   * GET /api/v1/signatures/:signatureId/qrcode
   */
  async genererQRCode(req, res) {
    try {
      const { signatureId } = req.params;
      
      console.log(`📱 [SIGNATURE CONTROLLER] Génération QR Code ${signatureId}`);
      
      const qrCode = await SignatureService.genererQRCodeVerification(signatureId);
      
      res.json({
        success: true,
        data: {
          qrCode, // Base64 image
          signatureId
        }
      });
      
    } catch (error) {
      console.error('❌ [SIGNATURE CONTROLLER] Erreur QR Code:', error);
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Lister les signatures d'une demande
   * GET /api/v1/signatures/demande/:demandeId
   */
  async listerSignatures(req, res) {
    try {
      const { demandeId } = req.params;
      
      console.log(`📋 [SIGNATURE CONTROLLER] Liste signatures demande ${demandeId}`);
      
      const signatures = await SignatureService.listerSignaturesDemande(demandeId);
      
      res.json({
        success: true,
        count: signatures.length,
        data: signatures
      });
      
    } catch (error) {
      console.error('❌ [SIGNATURE CONTROLLER] Erreur liste:', error);
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Invalider une signature (admin seulement)
   * DELETE /api/v1/signatures/:signatureId
   */
  async invaliderSignature(req, res) {
    try {
      const { signatureId } = req.params;
      const { raison } = req.body;
      const userId = req.user.userId || req.user._id;
      
      console.log(`⚠️ [SIGNATURE CONTROLLER] Invalidation signature ${signatureId}`);
      
      if (!raison) {
        return res.status(400).json({
          success: false,
          message: 'La raison d\'invalidation est requise'
        });
      }
      
      const signature = await SignatureService.invaliderSignature(
        signatureId,
        userId,
        raison
      );
      
      res.json({
        success: true,
        message: 'Signature invalidée',
        data: signature
      });
      
    } catch (error) {
      console.error('❌ [SIGNATURE CONTROLLER] Erreur invalidation:', error);
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new SignatureController();
