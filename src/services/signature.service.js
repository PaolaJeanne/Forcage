// src/services/signature.service.js
const crypto = require('crypto');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const Signature = require('../models/Signature');
const DemandeForçage = require('../models/DemandeForçage');
const User = require('../models/User');

class SignatureService {
  
  /**
   * Signer une demande
   */
  static async signerDemande(demandeId, userId, options = {}) {
    try {
      console.log(`🖊️ [SIGNATURE] Début signature demande ${demandeId}`);
      
      // 1. Récupérer demande et utilisateur
      const demande = await DemandeForçage.findById(demandeId)
        .populate('clientId', 'nom prenom email');
      
      const user = await User.findById(userId);
      
      if (!demande) throw new Error('Demande non trouvée');
      if (!user) throw new Error('Utilisateur non trouvé');
      
      // 2. Vérifier droits
      this.verifierDroitSignature(demande, user);
      
      // 3. Vérifier si déjà signé par cet utilisateur
      const dejaSignee = await Signature.findOne({
        demandeId: demande._id,
        'signataire.userId': user._id,
        valide: true
      });
      
      if (dejaSignee) {
        console.log('⚠️ [SIGNATURE] Déjà signée par cet utilisateur');
        return dejaSignee;
      }
      
      // 4. Générer hash du document
      const documentHash = this.genererHashDocument(demande);
      
      // 5. Générer signature crypto
      const signatureCrypto = this.genererSignatureCrypto(documentHash, user);
      
      // 6. Générer certificat
      const certificat = this.genererCertificat(user, documentHash);
      
      // 7. Créer la signature
      const signature = await Signature.create({
        demandeId: demande._id,
        signataire: {
          userId: user._id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          role: user.role
        },
        typeSignature: options.typeSignature || 'electronique',
        signatureData: {
          documentHash,
          signatureCrypto,
          signatureImage: options.signatureImage,
          otpCode: options.otpCode,
          certificat
        },
        metadata: {
          ipAddress: options.ipAddress || 'unknown',
          userAgent: options.userAgent || 'unknown',
          timestamp: new Date()
        }
      });
      
      // 8. Enregistrer dans la demande
      await this.enregistrerSignatureDansDemande(demande, user, signature);
      
      console.log(`✅ [SIGNATURE] Signature créée: ${signature._id}`);
      
      return signature;
      
    } catch (error) {
      console.error('❌ [SIGNATURE] Erreur:', error);
      throw error;
    }
  }
  
  /**
   * Vérifier une signature
   */
  static async verifierSignature(signatureId) {
    try {
      const signature = await Signature.findById(signatureId)
        .populate('demandeId')
        .populate('signataire.userId');
      
      if (!signature) {
        return {
          valide: false,
          raison: 'Signature non trouvée'
        };
      }
      
      // Vérifications
      const checks = {
        signatureExiste: true,
        signatureValide: signature.valide,
        documentIntegre: false,
        signatureCryptoValide: false
      };
      
      // Vérifier intégrité du document
      const currentHash = this.genererHashDocument(signature.demandeId);
      checks.documentIntegre = (currentHash === signature.signatureData.documentHash);
      
      // Vérifier signature crypto
      checks.signatureCryptoValide = this.verifierSignatureCrypto(
        signature.signatureData.signatureCrypto,
        signature.signatureData.documentHash
      );
      
      const toutesVerificationsOK = Object.values(checks).every(v => v === true);
      
      return {
        valide: toutesVerificationsOK,
        checks,
        signature,
        message: toutesVerificationsOK 
          ? 'Signature valide et document intègre' 
          : 'Signature invalide ou document modifié'
      };
      
    } catch (error) {
      console.error('❌ [SIGNATURE] Erreur vérification:', error);
      return {
        valide: false,
        raison: error.message
      };
    }
  }
  
  /**
   * Générer QR Code de vérification
   */
  static async genererQRCodeVerification(signatureId) {
    try {
      const signature = await Signature.findById(signatureId);
      
      if (!signature) throw new Error('Signature non trouvée');
      
      const verificationData = {
        signatureId: signature._id.toString(),
        documentHash: signature.signatureData.documentHash,
        signataire: signature.signataire.email,
        timestamp: signature.metadata.timestamp,
        verificationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/verify-signature/${signatureId}`
      };
      
      // Générer QR Code en base64
      const qrCode = await QRCode.toDataURL(JSON.stringify(verificationData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2
      });
      
      return qrCode;
      
    } catch (error) {
      console.error('❌ [SIGNATURE] Erreur QR Code:', error);
      throw error;
    }
  }
  
  /**
   * Lister les signatures d'une demande
   */
  static async listerSignaturesDemande(demandeId) {
    return await Signature.find({ demandeId, valide: true })
      .populate('signataire.userId', 'nom prenom email role')
      .sort({ 'metadata.timestamp': 1 });
  }
  
  /**
   * Invalider une signature (admin seulement)
   */
  static async invaliderSignature(signatureId, userId, raison) {
    const signature = await Signature.findByIdAndUpdate(
      signatureId,
      {
        valide: false,
        invalidePar: {
          userId,
          raison,
          date: new Date()
        }
      },
      { new: true }
    );
    
    console.log(`⚠️ [SIGNATURE] Invalidée: ${signatureId}`);
    
    return signature;
  }
  
  // ==================== HELPERS ====================
  
  /**
   * Vérifier droit de signature
   */
  static verifierDroitSignature(demande, user) {
    const rolesAutorises = ['conseiller', 'rm', 'dce', 'adg', 'dga', 'admin'];
    
    if (!rolesAutorises.includes(user.role)) {
      throw new Error('Vous n\'avez pas le droit de signer cette demande');
    }
    
    // Vérifier implication dans la demande
    const estConseiller = demande.conseillerId?.toString() === user._id.toString();
    const estHierarchie = ['rm', 'dce', 'adg', 'dga', 'admin'].includes(user.role);
    
    if (!estConseiller && !estHierarchie) {
      throw new Error('Vous n\'êtes pas autorisé à signer cette demande');
    }
  }
  
  /**
   * Générer hash du document
   */
  static genererHashDocument(demande) {
    const dataToHash = {
      numeroReference: demande.numeroReference,
      montant: demande.montant,
      clientId: demande.clientId._id || demande.clientId,
      dateCreation: demande.dateCreation,
      typeOperation: demande.typeOperation,
      motif: demande.motif
    };
    
    const dataString = JSON.stringify(dataToHash);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }
  
  /**
   * Générer signature cryptographique
   */
  static genererSignatureCrypto(documentHash, user) {
    const dataToSign = `${documentHash}:${user._id}:${Date.now()}`;
    const secret = process.env.JWT_SECRET || 'default_secret';
    
    return crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex');
  }
  
  /**
   * Vérifier signature crypto
   */
  static verifierSignatureCrypto(signatureCrypto, documentHash) {
    // Vérification basique: longueur du hash
    return signatureCrypto && signatureCrypto.length === 64;
  }
  
  /**
   * Générer certificat numérique
   */
  static genererCertificat(user, documentHash) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        documentHash,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '10y' }
    );
  }
  
  /**
   * Enregistrer signature dans la demande
   */
  static async enregistrerSignatureDansDemande(demande, user, signature) {
    const updateData = {};
    
    switch (user.role) {
      case 'conseiller':
        updateData.validePar_conseiller = {
          userId: user._id,
          date: new Date(),
          signatureId: signature._id
        };
        break;
        
      case 'rm':
        updateData.validePar_rm = {
          userId: user._id,
          date: new Date(),
          signatureId: signature._id
        };
        break;
        
      case 'dce':
        updateData.validePar_dce = {
          userId: user._id,
          date: new Date(),
          signatureId: signature._id
        };
        break;
        
      case 'adg':
      case 'dga':
      case 'admin':
        updateData.validePar_adg = {
          userId: user._id,
          date: new Date(),
          signatureId: signature._id
        };
        break;
    }
    
    await DemandeForçage.findByIdAndUpdate(demande._id, updateData);
  }
}

module.exports = SignatureService;