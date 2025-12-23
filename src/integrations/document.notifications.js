const NotificationUniversalService = require('../services/notification.service');

class DocumentNotifications {

  static async onDocumentUploaded(document, uploadedBy) {
    try {
      await NotificationUniversalService.notifyDocument({
        documentId: document._id,
        nomDocument: document.nom,
        typeDocument: document.type,
        destinataireId: document.proprietaire,
        declencheurId: uploadedBy,
        actionType: 'uploaded'
      });

      // Notifier les personnes concernées si spécifié
      if (document.concerne && document.concerne.length > 0) {
        for (const concerneId of document.concerne) {
          if (concerneId.toString() !== document.proprietaire.toString()) {
            await NotificationUniversalService.notifyDocument({
              documentId: document._id,
              nomDocument: document.nom,
              typeDocument: document.type,
              destinataireId: concerneId,
              declencheurId: uploadedBy,
              actionType: 'shared'
            });
          }
        }
      }

    } catch (error) {

    }
  }

  static async onDocumentValidated(document, validatedBy) {
    try {
      await NotificationUniversalService.notifyDocument({
        documentId: document._id,
        nomDocument: document.nom,
        typeDocument: document.type,
        destinataireId: document.proprietaire,
        declencheurId: validatedBy,
        actionType: 'validated'
      });

    } catch (error) {

    }
  }

  static async onDocumentRejected(document, rejectedBy, reason) {
    try {
      await NotificationUniversalService.notifyDocument({
        documentId: document._id,
        nomDocument: document.nom,
        typeDocument: document.type,
        destinataireId: document.proprietaire,
        declencheurId: rejectedBy,
        actionType: 'rejected',
        metadata: { rejectionReason: reason }
      });

    } catch (error) {

    }
  }
}

module.exports = DocumentNotifications;