const NotificationUniversalService = require('../services/notification.service');

class TacheNotifications {

  static async onTacheAssigned(tache, assignedBy) {
    try {
      await NotificationUniversalService.notifyTache({
        tacheId: tache._id,
        titreTache: tache.titre,
        destinataireId: tache.assignee,
        declencheurId: assignedBy,
        actionType: 'assigned',
        dateEcheance: tache.dateEcheance
      });

    } catch (error) {

    }
  }

  static async onTacheCompleted(tache, completedBy) {
    try {
      // Notifier le créateur de la tâche
      await NotificationUniversalService.notifyTache({
        tacheId: tache._id,
        titreTache: tache.titre,
        destinataireId: tache.createdBy,
        declencheurId: completedBy,
        actionType: 'completed',
        dateEcheance: tache.dateEcheance
      });

    } catch (error) {

    }
  }

  static async onTacheOverdue(tache) {
    try {
      await NotificationUniversalService.notifyTache({
        tacheId: tache._id,
        titreTache: tache.titre,
        destinataireId: tache.assignee,
        declencheurId: null,
        actionType: 'overdue',
        dateEcheance: tache.dateEcheance
      });

      // Notifier aussi le créateur
      if (tache.createdBy && tache.createdBy.toString() !== tache.assignee.toString()) {
        await NotificationUniversalService.notifyTache({
          tacheId: tache._id,
          titreTache: tache.titre,
          destinataireId: tache.createdBy,
          declencheurId: null,
          actionType: 'overdue',
          dateEcheance: tache.dateEcheance
        });
      }

    } catch (error) {

    }
  }
}

module.exports = TacheNotifications;