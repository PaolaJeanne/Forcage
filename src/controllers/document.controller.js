
// ============================================
// 3. CONTROLLER DOCUMENTS - controllers/document.controller.js
// ============================================
const DemandeForçage = require('../models/DemandeForçage');
const { successResponse, errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');


exports.creerDemandeAvecFichiers = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Nettoyer les fichiers si validation échoue
      if (req.files) {
        req.files.forEach(file => fs.unlinkSync(file.path));
      }
      return errorResponse(res, 400, 'Données invalides', errors.array());
    }
    
    // Créer la demande
    const demande = await demandeService.creerDemande(req.userId, req.body);
    
    // Ajouter les fichiers s'ils existent
    if (req.files && req.files.length > 0) {
      const fichiers = req.files.map(file => ({
        nom: file.originalname,
        url: `/uploads/pieces-justificatives/${file.filename}`,
        type: file.mimetype,
        taille: file.size,
        uploadedAt: new Date()
      }));
      
      demande.piecesJustificatives = fichiers;
      await demande.save();
    }
    
    logger.info(`Demande créée avec fichiers: ${demande.numeroReference}`);
    
    return successResponse(res, 201, 'Demande créée avec succès', { demande });
  } catch (error) {
    logger.error('Erreur création demande:', error);
    // Nettoyer les fichiers en cas d'erreur
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    return errorResponse(res, 500, 'Erreur lors de la création', error.message);
  }
};


// Upload de pièces justificatives pour une demande
exports.uploadPiecesJustificatives = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 400, 'Aucun fichier fourni');
    }
    
    // Récupérer la demande
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) {
      // Supprimer les fichiers uploadés si la demande n'existe pas
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      return errorResponse(res, 404, 'Demande introuvable');
    }
    
    // Vérifier les droits (le client doit être le propriétaire)
    if (req.userRole === 'client' && demande.clientId.toString() !== req.userId) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return errorResponse(res, 403, 'Non autorisé');
    }
    
    // Ajouter les fichiers à la demande
    const nouveauxFichiers = req.files.map(file => ({
      nom: file.originalname,
      url: `/uploads/pieces-justificatives/${file.filename}`,
      type: file.mimetype,
      taille: file.size,
      uploadedAt: new Date()
    }));
    
    demande.piecesJustificatives.push(...nouveauxFichiers);
    await demande.save();
    
    logger.info(`Fichiers uploadés pour demande ${id}: ${req.files.length} fichiers`);
    
    return successResponse(res, 200, 'Fichiers uploadés avec succès', {
      fichiers: nouveauxFichiers,
      totalFichiers: demande.piecesJustificatives.length
    });
    
  } catch (error) {
    logger.error('Erreur upload fichiers:', error);
    // Nettoyer les fichiers en cas d'erreur
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    return errorResponse(res, 500, 'Erreur lors de l\'upload', error.message);
  }
};

// Supprimer une pièce justificative
exports.supprimerPieceJustificative = async (req, res) => {
  try {
    const { id, fichierIndex } = req.params;
    
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }
    
    // Vérifier les droits
    if (req.userRole === 'client' && demande.clientId.toString() !== req.userId) {
      return errorResponse(res, 403, 'Non autorisé');
    }
    
    // Vérifier que l'index existe
    if (!demande.piecesJustificatives[fichierIndex]) {
      return errorResponse(res, 404, 'Fichier introuvable');
    }
    
    const fichier = demande.piecesJustificatives[fichierIndex];
    
    // Supprimer le fichier physique
    const filePath = path.join(__dirname, '../../', fichier.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Retirer du tableau
    demande.piecesJustificatives.splice(fichierIndex, 1);
    await demande.save();
    
    logger.info(`Fichier supprimé pour demande ${id}: ${fichier.nom}`);
    
    return successResponse(res, 200, 'Fichier supprimé avec succès');
    
  } catch (error) {
    logger.error('Erreur suppression fichier:', error);
    return errorResponse(res, 500, 'Erreur lors de la suppression', error.message);
  }
};

// Télécharger une pièce justificative
exports.telechargerPieceJustificative = async (req, res) => {
  try {
    const { id, fichierIndex } = req.params;
    
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }
    
    // Vérifier l'index
    if (!demande.piecesJustificatives[fichierIndex]) {
      return errorResponse(res, 404, 'Fichier introuvable');
    }
    
    const fichier = demande.piecesJustificatives[fichierIndex];
    const filePath = path.join(__dirname, '../../', fichier.url);
    
    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 404, 'Fichier physique introuvable');
    }
    
    // Télécharger le fichier
    res.download(filePath, fichier.nom, (err) => {
      if (err) {
        logger.error('Erreur téléchargement:', err);
        return errorResponse(res, 500, 'Erreur lors du téléchargement');
      }
    });
    
  } catch (error) {
    logger.error('Erreur téléchargement fichier:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};

// Lister toutes les pièces justificatives d'une demande
exports.listerPiecesJustificatives = async (req, res) => {
  try {
    const { id } = req.params;
    
    const demande = await DemandeForçage.findById(id).select('piecesJustificatives');
    
    if (!demande) {
      return errorResponse(res, 404, 'Demande introuvable');
    }
    
    return successResponse(res, 200, 'Liste des pièces justificatives', {
      fichiers: demande.piecesJustificatives,
      total: demande.piecesJustificatives.length
    });
    
  } catch (error) {
    logger.error('Erreur listing fichiers:', error);
    return errorResponse(res, 500, 'Erreur serveur', error.message);
  }
};
