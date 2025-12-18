const NotificationUniversalService = require('../services/notification.service');

class DemandeNotifications {
  
  static async onDemandeCreated(demande) {
    try {
      // Notifier le client
      await NotificationUniversalService.notifyDemande({
        demandeId: demande._id,
        numeroReference: demande.numeroReference,
        typeDemande: demande.typeOperation,
        montant: demande.montant,
        statut: demande.statut,
        destinataireId: demande.clientId,
        declencheurId: demande.createdBy,
        actionType: 'created'
      });
      
      // Notifier le conseiller assigné
      if (demande.conseillerId) {
        await NotificationUniversalService.notifyDemande({
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          typeDemande: demande.typeOperation,
          montant: demande.montant,
          statut: demande.statut,
          destinataireId: demande.conseillerId,
          declencheurId: demande.createdBy,
          actionType: 'assigned'
        });
      }
      
      console.log(`✅ Notifications envoyées pour demande créée: ${demande.numeroReference}`);
      
    } catch (error) {
      console.error('❌ Erreur notifications demande créée:', error);
    }
  }
  
  static async onDemandeUpdated(demande, previousState, updatedBy) {
    try {
      const destinataires = [demande.clientId, demande.conseillerId].filter(Boolean);
      
      for (const destinataireId of destinataires) {
        await NotificationUniversalService.notifyDemande({
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          typeDemande: demande.typeOperation,
          montant: demande.montant,
          statut: demande.statut,
          destinataireId,
          declencheurId: updatedBy,
          actionType: 'updated'
        });
      }
      
    } catch (error) {
      console.error('❌ Erreur notifications demande mise à jour:', error);
    }
  }
  
  static async onDemandeStatusChanged(demande, previousStatus, changedBy) {
    try {
      const actionType = demande.statut === 'validée' ? 'validated' :
                        demande.statut === 'rejetée' ? 'rejected' :
                        demande.statut === 'complétée' ? 'completed' : 'updated';
      
      // Notifier le client
      await NotificationUniversalService.notifyDemande({
        demandeId: demande._id,
        numeroReference: demande.numeroReference,
        typeDemande: demande.typeOperation,
        montant: demande.montant,
        statut: demande.statut,
        destinataireId: demande.clientId,
        declencheurId: changedBy,
        actionType
      });
      
      // Notifier le conseiller
      if (demande.conseillerId) {
        await NotificationUniversalService.notifyDemande({
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          typeDemande: demande.typeOperation,
          montant: demande.montant,
          statut: demande.statut,
          destinataireId: demande.conseillerId,
          declencheurId: changedBy,
          actionType
        });
      }
      
      // Notifier les administrateurs si rejet ou validation
      if (demande.statut === 'validée' || demande.statut === 'rejetée') {
        const User = require('../models/User');
        const admins = await User.find({
          role: { $in: ['admin', 'dga'] },
          _id: { $nin: [demande.clientId, demande.conseillerId, changedBy] }
        }).select('_id');
        
        for (const admin of admins) {
          await NotificationUniversalService.notifyDemande({
            demandeId: demande._id,
            numeroReference: demande.numeroReference,
            typeDemande: demande.typeOperation,
            montant: demande.montant,
            statut: demande.statut,
            destinataireId: admin._id,
            declencheurId: changedBy,
            actionType
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur notifications changement statut:', error);
    }
  }
  
  static async onDemandeCommentAdded(demande, comment, commentBy) {
    try {
      // Notifier le propriétaire de la demande (client)
      await NotificationUniversalService.notifyDemande({
        demandeId: demande._id,
        numeroReference: demande.numeroReference,
        typeDemande: demande.typeOperation,
        montant: demande.montant,
        statut: demande.statut,
        destinataireId: demande.clientId,
        declencheurId: commentBy,
        actionType: 'commented'
      });
      
      // Notifier l'autre partie (conseiller si commentaire par client, client si commentaire par conseiller)
      const otherParty = commentBy.toString() === demande.clientId.toString() 
        ? demande.conseillerId 
        : demande.clientId;
      
      if (otherParty) {
        await NotificationUniversalService.notifyDemande({
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          typeDemande: demande.typeOperation,
          montant: demande.montant,
          statut: demande.statut,
          destinataireId: otherParty,
          declencheurId: commentBy,
          actionType: 'commented'
        });
      }
      
    } catch (error) {
      console.error('❌ Erreur notifications commentaire:', error);
    }
  }
  
  static async onDemandeEcheance(demande, daysUntilDue) {
    try {
      const destinataires = [demande.clientId, demande.conseillerId].filter(Boolean);
      const actionType = daysUntilDue <= 0 ? 'overdue' : 'echeance';
      
      for (const destinataireId of destinataires) {
        await NotificationUniversalService.notifyDemande({
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          typeDemande: demande.typeOperation,
          montant: demande.montant,
          statut: 'en_retard',
          destinataireId,
          declencheurId: null,
          actionType
        });
      }
      
    } catch (error) {
      console.error('❌ Erreur notifications échéance:', error);
    }
  }
}

module.exports = DemandeNotifications;