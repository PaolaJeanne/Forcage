/**
 * Hooks simples pour les notifications automatiques
 */

const NotificationService = require('../services/notification.service');

// Variable pour suivre les documents qui viennent d'être créés
const newlyCreatedDocs = new Set();

// Hook pour le modèle DemandeForçage
// Hook pour le modèle DemandeForçage
function setupDemandeHooks(DemandeForçage) {
  if (!DemandeForçage || !DemandeForçage.schema) {
    return;
  }

  // Hook PRE-save pour marquer les nouveaux documents
  // Note: function non-async avec next fonctionne
  DemandeForçage.schema.pre('save', function (next) {

    // Marquer comme nouvellement créé si c'est un nouveau document
    if (this.isNew) {
      newlyCreatedDocs.add(this._id.toString());
    }

    next();
  });

  // Hook POST-save pour les notifications
  // CORRECTION: async post hooks ne doivent pas utiliser next() dans Mongoose moderne
  DemandeForçage.schema.post('save', async function (doc) {
    try {
      const docId = doc._id.toString();
      const isNew = newlyCreatedDocs.has(docId);

      if (isNew) {
        // Notification création de demande
        await NotificationService.notifyDemandeCreated(doc);

        // Nettoyer le cache
        newlyCreatedDocs.delete(docId);
      } else {
        // Notification mise à jour de demande
        await NotificationService.notifyDemandeUpdated(doc);

        // Vérifier les changements de statut spécifiquement
        const original = await DemandeForçage.findById(doc._id);
        if (original && original.statut !== doc.statut) {
          const changedBy = doc.updatedBy || doc.conseillerId || null;
          await NotificationService.notifyDemandeStatusChanged(doc, original.statut, changedBy);
        }
      }

    } catch (error) {
      // Ne pas bloquer l'opération
      console.error('Error in post-save hook:', error);
    }
  });

  // Hook pour les mises à jour via findOneAndUpdate
  // CORRECTION: async post hooks ne doivent pas utiliser next()
  DemandeForçage.schema.post('findOneAndUpdate', async function (result) {
    try {
      if (result) {

        // Attendre un peu pour être sûr que le document est mis à jour
        setTimeout(async () => {
          try {
            const updatedDoc = await DemandeForçage.findById(result._id);
            if (updatedDoc) {
              await NotificationService.notifyDemandeUpdated(updatedDoc);
            }
          } catch (err) {
            console.error('Error in post-findOneAndUpdate timeout:', err);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error in post-findOneAndUpdate hook:', error);
    }
  });
}

module.exports = {
  setupDemandeHooks
};