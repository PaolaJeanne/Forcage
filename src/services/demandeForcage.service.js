const DemandeForçage = require('../models/DemandeForçage');

class DemandeForçageService {
  
  // Créer une demande
  async creerDemande(clientId, data) {
    const demande = new DemandeForçage({
      clientId,
      ...data,
      statut: 'BROUILLON',
      dateEcheance: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // J+15
    });
    
    demande.ajouterHistorique('CREATION', clientId, 'Demande créée');
    await demande.save();
    
    return demande;
  }
  
  // Lister les demandes (avec filtres)
  async listerDemandes(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = '-createdAt' } = options;
    const query = {};
    
    if (filters.clientId) query.clientId = filters.clientId;
    if (filters.conseillerId) query.conseillerId = filters.conseillerId;
    if (filters.statut) query.statut = filters.statut;
    if (filters.scoreRisque) query.scoreRisque = filters.scoreRisque;
    
    const demandes = await DemandeForçage.find(query)
      .populate('clientId', 'nom prenom email')
      .populate('conseillerId', 'nom prenom')
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await DemandeForçage.countDocuments(query);
    
    return {
      demandes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  // Obtenir une demande par ID
  async getDemandeById(id, userId) {
    const demande = await DemandeForçage.findById(id)
      .populate('clientId', 'nom prenom email telephone')
      .populate('conseillerId', 'nom prenom email')
      .populate('responsableId', 'nom prenom');
    
    if (!demande) {
      throw new Error('Demande introuvable');
    }
    
    return demande;
  }
  
  // Soumettre une demande (passage de BROUILLON à ENVOYEE)
  async soumettreDemande(id, userId) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    if (demande.clientId.toString() !== userId.toString()) {
      throw new Error('Non autorisé');
    }
    if (demande.statut !== 'BROUILLON') {
      throw new Error('Demande déjà soumise');
    }
    
    demande.statut = 'ENVOYEE';
    demande.ajouterHistorique('SOUMISSION', userId, 'Demande envoyée pour traitement');
    
    await demande.save();
    
    // TODO: Envoyer notification au conseiller
    
    return demande;
  }
  
  // Annuler une demande (client uniquement si statut = BROUILLON ou ENVOYEE)
  async annulerDemande(id, userId) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    if (demande.clientId.toString() !== userId.toString()) {
      throw new Error('Non autorisé');
    }
    if (!['BROUILLON', 'ENVOYEE'].includes(demande.statut)) {
      throw new Error('Impossible d\'annuler une demande en cours de traitement');
    }
    
    demande.statut = 'ANNULEE';
    demande.ajouterHistorique('ANNULATION', userId, 'Demande annulée par le client');
    
    await demande.save();
    return demande;
  }
  
  // Traiter une demande (conseiller/responsable)
  async traiterDemande(id, userId, action, data = {}) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    
    const { statut, commentaire, montantAutorise, conditionsParticulieres } = data;
    
    // Vérifications selon le rôle (à adapter selon votre logique métier)
    if (action === 'PRENDRE_EN_CHARGE') {
      demande.conseillerId = userId;
      demande.statut = 'EN_ETUDE';
      demande.ajouterHistorique('PRISE_EN_CHARGE', userId, commentaire);
    }
    
    if (action === 'VALIDER') {
      demande.statut = 'VALIDEE';
      demande.montantAutorise = montantAutorise || demande.montant;
      demande.dateTraitement = new Date();
      demande.commentaireTraitement = commentaire;
      demande.conditionsParticulieres = conditionsParticulieres;
      demande.ajouterHistorique('VALIDATION', userId, commentaire);
    }
    
    if (action === 'REFUSER') {
      demande.statut = 'REFUSEE';
      demande.dateTraitement = new Date();
      demande.commentaireTraitement = commentaire;
      demande.ajouterHistorique('REFUS', userId, commentaire);
    }
    
    if (action === 'DEMANDER_INFO') {
      demande.ajouterHistorique('DEMANDE_INFO', userId, commentaire);
    }
    
    await demande.save();
    
    // TODO: Envoyer notification au client
    
    return demande;
  }
  
  // Marquer comme régularisée
  async regulariser(id, userId) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    if (demande.statut !== 'VALIDEE') {
      throw new Error('Seules les demandes validées peuvent être régularisées');
    }
    
    demande.regularisee = true;
    demande.dateRegularisation = new Date();
    demande.ajouterHistorique('REGULARISATION', userId, 'Opération régularisée');
    
    await demande.save();
    return demande;
  }
  
  // Statistiques
  async getStatistiques(filters = {}) {
    const match = {};
    if (filters.clientId) match.clientId = filters.clientId;
    if (filters.dateDebut) match.createdAt = { $gte: new Date(filters.dateDebut) };
    
    const stats = await DemandeForçage.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          montantTotal: { $sum: '$montant' },
          validees: { $sum: { $cond: [{ $eq: ['$statut', 'VALIDEE'] }, 1, 0] } },
          refusees: { $sum: { $cond: [{ $eq: ['$statut', 'REFUSEE'] }, 1, 0] } },
          enCours: { $sum: { $cond: [{ $in: ['$statut', ['ENVOYEE', 'EN_ETUDE', 'EN_VALIDATION']] }, 1, 0] } },
          nonRegularisees: { $sum: { $cond: [{ $and: [{ $eq: ['$statut', 'VALIDEE'] }, { $eq: ['$regularisee', false] }] }, 1, 0] } }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      montantTotal: 0,
      validees: 0,
      refusees: 0,
      enCours: 0,
      nonRegularisees: 0
    };
  }
}

module.exports = new DemandeForçageService();