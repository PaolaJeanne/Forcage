/**
 * Hooks simples pour les notifications automatiques
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

  // Hook POST-save pour les notifications
  DemandeForçage.schema.post('save', async function (doc, next) {
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
    }
    next();
  });

  // Hook pour les mises à jour via findOneAndUpdate
  DemandeForçage.schema.post('findOneAndUpdate', async function (result, next) {
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
          }
        }, 100);
      }
    } catch (error) {
    }
    next();
  });
}

module.exports = {
  setupDemandeHooks
};