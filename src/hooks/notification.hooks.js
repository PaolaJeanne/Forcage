/**
 * Hooks simples pour les notifications automatiques
 * 
 * NOTE: Les notifications sont maintenant gérées directement par le controller
 * pour avoir un meilleur contrôle et éviter les doublons.
 * Ces hooks sont conservés pour la compatibilité mais ne font rien.
 */

const NotificationService = require('../services/notification.service');

// Variable pour suivre les documents qui viennent d'être créés
const newlyCreatedDocs = new Set();

// Hook pour le modèle DemandeForçage
function setupDemandeHooks(DemandeForçage) {
  if (!DemandeForçage || !DemandeForçage.schema) {
    return;
  }

  // Hook PRE-save pour marquer les nouveaux documents
  DemandeForçage.schema.pre('save', function (next) {
    // Marquer comme nouvellement créé si c'est un nouveau document
    if (this.isNew) {
      newlyCreatedDocs.add(this._id.toString());
    }
    next();
  });

  // Hook POST-save - DÉSACTIVÉ
  // Les notifications sont maintenant gérées par le controller
  // pour éviter les doublons et avoir un meilleur contrôle
  DemandeForçage.schema.post('save', async function (doc) {
    try {
      const docId = doc._id.toString();
      
      // Nettoyer le cache
      if (newlyCreatedDocs.has(docId)) {
        newlyCreatedDocs.delete(docId);
      }
      
      // Les notifications sont envoyées par le controller
      // Pas d'action ici
    } catch (error) {
      console.error('Error in post-save hook:', error);
    }
  });

  // Hook pour les mises à jour via findOneAndUpdate - DÉSACTIVÉ
  DemandeForçage.schema.post('findOneAndUpdate', async function (result) {
    try {
      // Les notifications sont envoyées par le controller
      // Pas d'action ici
    } catch (error) {
      console.error('Error in post-findOneAndUpdate hook:', error);
    }
  });
}

module.exports = {
  setupDemandeHooks
};