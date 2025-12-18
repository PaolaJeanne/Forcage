/**
 * Hooks simples pour les notifications automatiques
 */

const NotificationService = require('../services/notification.service');

// Variable pour suivre les documents qui viennent d'être créés
const newlyCreatedDocs = new Set();

// Hook pour le modèle DemandeForçage
function setupDemandeHooks(DemandeForçage) {
  console.log('🔗 Configuration des hooks pour DemandeForçage...');
  
  if (!DemandeForçage || !DemandeForçage.schema) {
    console.error('❌ Erreur: Modèle ou schéma DemandeForçage non disponible');
    return;
  }
  
  // Hook PRE-save pour marquer les nouveaux documents
  DemandeForçage.schema.pre('save', function(next) {
    console.log(`📝 Hook pre-save pour demande: ${this._id}, isNew: ${this.isNew}`);
    
    // Marquer comme nouvellement créé si c'est un nouveau document
    if (this.isNew) {
      newlyCreatedDocs.add(this._id.toString());
      console.log(`🆕 Document marqué comme nouveau: ${this._id}`);
    }
    
    next();
  });
  
  // Hook POST-save pour les notifications
  DemandeForçage.schema.post('save', async function(doc, next) {
    try {
      const docId = doc._id.toString();
      const isNew = newlyCreatedDocs.has(docId);
      
      console.log(`📝 Hook post-save pour demande: ${docId}, estNouveau: ${isNew}`);
      
      if (isNew) {
        // Notification création de demande
        console.log(`🎉 Création de demande détectée: ${docId}`);
        await NotificationService.notifyDemandeCreated(doc);
        
        // Nettoyer le cache
        newlyCreatedDocs.delete(docId);
      } else {
        // Notification mise à jour de demande
        console.log(`✏️ Mise à jour de demande détectée: ${docId}`);
        await NotificationService.notifyDemandeUpdated(doc);
        
        // Vérifier les changements de statut spécifiquement
        const original = await DemandeForçage.findById(doc._id);
        if (original && original.statut !== doc.statut) {
          console.log(`🔄 Changement de statut détecté: ${original.statut} -> ${doc.statut}`);
          const changedBy = doc.updatedBy || doc.conseillerId || null;
          await NotificationService.notifyDemandeStatusChanged(doc, original.statut, changedBy);
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur hook demande save:', error.message);
      // Ne pas bloquer l'opération
    }
    next();
  });
  
  // Hook pour les mises à jour via findOneAndUpdate
  DemandeForçage.schema.post('findOneAndUpdate', async function(result, next) {
    try {
      if (result) {
        console.log(`🔄 Hook post-findOneAndUpdate pour demande: ${result._id}`);
        
        // Attendre un peu pour être sûr que le document est mis à jour
        setTimeout(async () => {
          try {
            const updatedDoc = await DemandeForçage.findById(result._id);
            if (updatedDoc) {
              await NotificationService.notifyDemandeUpdated(updatedDoc);
            }
          } catch (err) {
            console.error('❌ Erreur async hook update:', err.message);
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Erreur hook demande findOneAndUpdate:', error.message);
    }
    next();
  });
  
  console.log('✅ Hooks de demandes configurés avec succès');
}

module.exports = {
  setupDemandeHooks
};