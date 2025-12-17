// ============================================
// SERVICE DEMANDE FORÇAGE COMPLET - src/services/demandeForcage.service.js
// ============================================
const DemandeForçage = require('../models/DemandeForçage');
const User = require('../models/User');
const { calculerScoreRisque } = require('../utils/riskCalculator');

class DemandeForçageService {
  
 // ==================== CRÉATION ====================
async creerDemande(clientId, data) {
  const client = await User.findById(clientId);
  if (!client) throw new Error('Client introuvable');
  
  const numeroReference = await this.genererNumeroReference();
  const scoreRisque = this.calculerScoreRisqueDemande(client, data.montant);
  
  // ✅ UTILISER create() directement
  const demande = await DemandeForçage.create({
    numeroReference,
    clientId,
    statut: 'BROUILLON',
    agenceId: client.agence,
    notationClient: client.notationClient || data.notationClient,
    classification: client.classification || data.classification,
    scoreRisque,
    priorite: this.determinerPriorite(scoreRisque, data.montant),
    dateEcheance: data.dateEcheance || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ...data  // ✅ Spread à la fin pour que piecesJustificatives ne soit pas écrasé
  });
  
  // Ajouter historique après création
  demande.historique.push({
    action: 'CREATION',
    statutAvant: null,
    statutApres: 'BROUILLON',
    userId: clientId,
    commentaire: 'Demande créée',
    timestamp: new Date()
  });
  
  await demande.save();
  
  return demande;
}

  // ==================== LISTAGE ====================
  async listerDemandes(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = '-createdAt' } = options;
    const query = this.construireQueryFiltres(filters);
    
    // Population selon les besoins
    const selectFields = this.getSelectFields(filters.role);
    
    const demandes = await DemandeForçage.find(query)
      .populate('clientId', selectFields.client)
      .populate('conseillerId', selectFields.conseiller)
      .populate('responsableId', selectFields.responsable)
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
  
  // ==================== CONSULTATION ====================
  async getDemandeById(id) {
    const demande = await DemandeForçage.findById(id)
      .populate('clientId', 'nom prenom email telephone agence notationClient classification')
      .populate('conseillerId', 'nom prenom email role agence limiteAutorisation')
      .populate('responsableId', 'nom prenom email role');
    
    if (!demande) {
      throw new Error('Demande introuvable');
    }
    
    return demande;
  }
  
  // ==================== SOUMISSION ====================
  async soumettreDemande(id, userId) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    
    // Vérifications
    if (demande.clientId.toString() !== userId.toString()) {
      throw new Error('Non autorisé - Vous n\'êtes pas le propriétaire de cette demande');
    }
    
    if (demande.statut !== 'BROUILLON') {
      throw new Error('Demande déjà soumise ou en cours de traitement');
    }
    
    // Mettre à jour le statut
    demande.statut = 'ENVOYEE';
    demande.ajouterHistorique('SOUMISSION', userId, 'Demande envoyée pour traitement');
    
    await demande.save();
    
    // Assigner automatiquement un conseiller
    await this.assignerConseillerAutomatique(id);
    
    return demande;
  }
  
  // ==================== ANNULATION ====================
  async annulerDemande(id, userId) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    
    // Vérifications
    if (demande.clientId.toString() !== userId.toString()) {
      throw new Error('Non autorisé - Seul le client peut annuler sa demande');
    }
    
    if (!['BROUILLON', 'ENVOYEE'].includes(demande.statut)) {
      throw new Error('Impossible d\'annuler une demande en cours de traitement');
    }
    
    // Mettre à jour
    demande.statut = 'ANNULEE';
    demande.ajouterHistorique('ANNULATION', userId, 'Demande annulée par le client');
    
    await demande.save();
    return demande;
  }
  
  // ==================== TRAITEMENT ====================
  async traiterDemande(id, userId, action, data = {}) {
    const demande = await DemandeForçage.findById(id);
    const user = await User.findById(userId);
    
    if (!demande) throw new Error('Demande introuvable');
    if (!user) throw new Error('Utilisateur introuvable');
    
    // Vérifier que l'utilisateur peut effectuer cette action
    const actionsAutorisees = this.getActionsAutorisees(user.role, demande.statut);
    if (!actionsAutorisees.includes(action)) {
      throw new Error(`Action "${action}" non autorisée pour votre rôle`);
    }
    
    const { commentaire, montantAutorise, conditionsParticulieres } = data;
    
    // Logique de traitement selon l'action
    switch (action) {
      case 'PRENDRE_EN_CHARGE':
        return await this.prendreEnCharge(demande, userId, commentaire);
        
      case 'VALIDER':
        return await this.validerDemande(demande, userId, montantAutorise, commentaire, conditionsParticulieres);
        
      case 'REFUSER':
        return await this.refuserDemande(demande, userId, commentaire);
        
      case 'DEMANDER_INFO':
        return await this.demanderInfo(demande, userId, commentaire);
        
      case 'REMONTER':
        return await this.remonterDemande(id, userId, commentaire);
        
      default:
        throw new Error('Action non reconnue');
    }
  }
  
  // ==================== RÉGULARISATION ====================
  async regulariser(id, userId) {
    const demande = await DemandeForçage.findById(id);
    
    if (!demande) throw new Error('Demande introuvable');
    
    if (demande.statut !== 'VALIDEE') {
      throw new Error('Seules les demandes validées peuvent être régularisées');
    }
    
    if (demande.regularisee) {
      throw new Error('Cette demande est déjà régularisée');
    }
    
    demande.regularisee = true;
    demande.dateRegularisation = new Date();
    demande.ajouterHistorique('REGULARISATION', userId, 'Opération régularisée');
    
    await demande.save();
    return demande;
  }
  
  // ==================== STATISTIQUES ====================
  async getStatistiques(filters = {}) {
    const match = this.construireMatchStatistiques(filters);
    
    const stats = await DemandeForçage.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          montantTotal: { $sum: '$montant' },
          montantAutoriseTotal: { $sum: '$montantAutorise' },
          validees: { $sum: { $cond: [{ $eq: ['$statut', 'VALIDEE'] }, 1, 0] } },
          refusees: { $sum: { $cond: [{ $eq: ['$statut', 'REFUSEE'] }, 1, 0] } },
          annulees: { $sum: { $cond: [{ $eq: ['$statut', 'ANNULEE'] }, 1, 0] } },
          enCours: { $sum: { $cond: [{ $in: ['$statut', ['ENVOYEE', 'EN_ETUDE', 'EN_VALIDATION']] }, 1, 0] } },
          nonRegularisees: { $sum: { $cond: [{ $and: [{ $eq: ['$statut', 'VALIDEE'] }, { $eq: ['$regularisee', false] }] }, 1, 0] } },
          enRetard: { $sum: { $cond: [{ $and: [{ $eq: ['$statut', 'VALIDEE'] }, { $eq: ['$regularisee', false] }, { $lt: ['$dateEcheance', new Date()] }] }, 1, 0] } }
        }
      },
      {
        $addFields: {
          tauxValidation: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$validees', '$total'] }, 100] }, 0] },
          tauxRefus: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$refusees', '$total'] }, 100] }, 0] },
          tauxRegularisation: { $cond: [{ $gt: ['$validees', 0] }, { $multiply: [{ $divide: [{ $subtract: ['$validees', '$nonRegularisees'] }, '$validees'] }, 100] }, 0] }
        }
      }
    ]);
    
    return stats[0] || this.getStatsParDefaut();
  }
  
  // ==================== MÉTHODES DE TRAITEMENT DÉTAILLÉES ====================
  
  async prendreEnCharge(demande, userId, commentaire = '') {
    demande.conseillerId = userId;
    demande.statut = 'EN_ETUDE';
    demande.ajouterHistorique('PRISE_EN_CHARGE', userId, commentaire || 'Prise en charge par le conseiller');
    
    await demande.save();
    return demande;
  }
  
  async validerDemande(demande, userId, montantAutorise, commentaire = '', conditions = '') {
    // Vérifier les limites d'autorisation
    await this.verifierLimiteAutorisation(userId, montantAutorise || demande.montant);
    
    demande.statut = 'VALIDEE';
    demande.montantAutorise = montantAutorise || demande.montant;
    demande.dateTraitement = new Date();
    demande.commentaireTraitement = commentaire;
    demande.conditionsParticulieres = conditions;
    demande.responsableId = userId;
    demande.ajouterHistorique('VALIDATION', userId, commentaire || 'Demande validée');
    
    await demande.save();
    return demande;
  }
  
  async refuserDemande(demande, userId, commentaire = '') {
    demande.statut = 'REFUSEE';
    demande.dateTraitement = new Date();
    demande.commentaireTraitement = commentaire;
    demande.responsableId = userId;
    demande.ajouterHistorique('REFUS', userId, commentaire || 'Demande refusée');
    
    await demande.save();
    return demande;
  }
  
  async demanderInfo(demande, userId, commentaire = '') {
    demande.ajouterHistorique('DEMANDE_INFO', userId, commentaire || 'Informations complémentaires demandées');
    
    await demande.save();
    return demande;
  }
  
  // ==================== MÉTHODES UTILITAIRES ====================
  
  async assignerConseillerAutomatique(demandeId) {
    const demande = await DemandeForçage.findById(demandeId).populate('clientId');
    
    if (!demande || !demande.clientId) {
      throw new Error('Demande ou client introuvable');
    }
    
    // Trouver un conseiller disponible dans la même agence
    const conseiller = await User.findOne({
      role: 'conseiller',
      agence: demande.clientId.agence,
      isActive: true
    }).sort({ 'limiteAutorisation': -1 });
    
    if (conseiller) {
      demande.conseillerId = conseiller._id;
      demande.ajouterHistorique('AUTO_ASSIGNMENT', conseiller._id, 'Assigné automatiquement');
      await demande.save();
      
      // TODO: Notification
    }
    
    return demande;
  }
  
  async verifierLimiteAutorisation(userId, montant) {
    const user = await User.findById(userId);
    
    if (!user) throw new Error('Utilisateur introuvable');
    
    // Admins et rôles supérieurs n'ont pas de limite
    if (['admin', 'dga'].includes(user.role)) {
      return true;
    }
    
    // Vérifier la limite d'autorisation
    if (user.limiteAutorisation < montant) {
      throw new Error(`Montant (${montant}) dépasse votre limite d'autorisation (${user.limiteAutorisation})`);
    }
    
    return true;
  }
  
  async remonterDemande(demandeId, userId, commentaire = '') {
    const demande = await DemandeForçage.findById(demandeId);
    const user = await User.findById(userId);
    
    if (!demande || !user) {
      throw new Error('Demande ou utilisateur introuvable');
    }
    
    let nouveauStatut = demande.statut;
    let actionHistorique = '';
    
    // Logique de remontée hiérarchique
    if (demande.statut === 'EN_ETUDE' && user.role === 'conseiller') {
      nouveauStatut = 'EN_VALIDATION';
      actionHistorique = 'REMONTEE_RM';
    } else if (demande.statut === 'EN_VALIDATION' && ['conseiller', 'rm'].includes(user.role)) {
      nouveauStatut = 'EN_VALIDATION_DCE';
      actionHistorique = 'REMONTEE_DCE';
    } else {
      throw new Error('Impossible de remonter cette demande');
    }
    
    demande.statut = nouveauStatut;
    demande.ajouterHistorique(actionHistorique, userId, `Remontée: ${commentaire}`);
    
    await demande.save();
    return demande;
  }
  
  getWorkflowDisponible(userRole, demandeStatut) {
    const workflows = {
      client: {
        BROUILLON: ['SOUMETTRE', 'SUPPRIMER'],
        ENVOYEE: ['ANNULER'],
        EN_ETUDE: ['ANNULER']
      },
      conseiller: {
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['REFUSER', 'REMONTER', 'DEMANDER_INFO']
      },
      rm: {
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION_DCE: ['VALIDER', 'REFUSER', 'DEMANDER_INFO']
      },
      dce: {
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_VALIDATION_DCE: ['VALIDER', 'REFUSER', 'DEMANDER_INFO']
      },
      adg: {
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_VALIDATION_DCE: ['VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        VALIDEE: ['REGULARISER', 'ANNULER_VALIDATION'],
        REFUSEE: ['REVOIR']
      },
      dga: {
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_VALIDATION_DCE: ['VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        VALIDEE: ['REGULARISER', 'ANNULER_VALIDATION'],
        REFUSEE: ['REVOIR']
      },
      admin: {
        BROUILLON: ['SUPPRIMER'],
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        VALIDEE: ['REGULARISER', 'ANNULER_VALIDATION'],
        REFUSEE: ['REVOIR'],
        ANNULEE: ['REACTIVER']
      },
      risques: {
        ENVOYEE: ['PRENDRE_EN_CHARGE', 'VALIDER', 'REFUSER', 'DEMANDER_INFO'],
        EN_ETUDE: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION: ['VALIDER', 'REFUSER', 'REMONTER', 'DEMANDER_INFO'],
        EN_VALIDATION_DCE: ['VALIDER', 'REFUSER', 'DEMANDER_INFO']
      }
    };
    
    return workflows[userRole]?.[demandeStatut] || [];
  }
  
  getActionsAutorisees(userRole, demandeStatut) {
    return this.getWorkflowDisponible(userRole, demandeStatut);
  }
  
  // ==================== MÉTHODES DE CALCUL ====================
  
  calculerScoreRisqueDemande(client, montant) {
    let score = 0;
    
    // Notation client
    const notations = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
    score += notations[client.notationClient] || 3;
    
    // Montant (au-dessus de 10M = risque accru)
    if (montant > 10000000) score += 2;
    else if (montant > 5000000) score += 1;
    
    // Classification client
    if (client.classification === 'sensible') score += 2;
    if (client.classification === 'restructure') score += 3;
    if (client.classification === 'defaut') score += 4;
    
    // Historique (à implémenter)
    
    // Déterminer le niveau
    if (score >= 8) return 'CRITIQUE';
    if (score >= 6) return 'ELEVE';
    if (score >= 4) return 'MOYEN';
    return 'FAIBLE';
  }
  
  determinerPriorite(scoreRisque, montant) {
    if (scoreRisque === 'CRITIQUE' || montant > 20000000) {
      return 'URGENTE';
    }
    return 'NORMALE';
  }
  
  // ==================== MÉTHODES DE CONSTRUCTION ====================
  
  construireQueryFiltres(filters) {
    const query = {};
    
    // Filtres de base
    if (filters.clientId) query.clientId = filters.clientId;
    if (filters.conseillerId) query.conseillerId = filters.conseillerId;
    if (filters.statut) query.statut = filters.statut;
    if (filters.scoreRisque) query.scoreRisque = filters.scoreRisque;
    if (filters.typeOperation) query.typeOperation = filters.typeOperation;
    if (filters.agenceId) query.agenceId = filters.agenceId;
    if (filters.priorite) query.priorite = filters.priorite;
    
    // Filtres dates
    if (filters.dateDebut || filters.dateFin) {
      query.createdAt = {};
      if (filters.dateDebut) query.createdAt.$gte = new Date(filters.dateDebut);
      if (filters.dateFin) query.createdAt.$lte = new Date(filters.dateFin);
    }
    
    // Filtre en retard
    if (filters.enRetard === 'true') {
      query.statut = 'VALIDEE';
      query.regularisee = false;
      query.dateEcheance = { $lt: new Date() };
    }
    
    return query;
  }
  
  construireMatchStatistiques(filters) {
    const match = {};
    
    if (filters.clientId) match.clientId = filters.clientId;
    if (filters.agenceId) match.agenceId = filters.agenceId;
    if (filters.statut) match.statut = filters.statut;
    
    // Filtres dates
    if (filters.dateDebut || filters.dateFin) {
      match.createdAt = {};
      if (filters.dateDebut) match.createdAt.$gte = new Date(filters.dateDebut);
      if (filters.dateFin) match.createdAt.$lte = new Date(filters.dateFin);
    }
    
    return match;
  }
  
  getSelectFields(role) {
    const baseFields = {
      client: 'nom prenom email',
      conseiller: 'nom prenom',
      responsable: 'nom prenom'
    };
    
    switch (role) {
      case 'admin':
      case 'dga':
      case 'risques':
        return {
          client: 'nom prenom email telephone agence notationClient classification',
          conseiller: 'nom prenom email role agence',
          responsable: 'nom prenom email role'
        };
        
      case 'rm':
      case 'dce':
        return {
          client: 'nom prenom email telephone agence',
          conseiller: 'nom prenom email',
          responsable: 'nom prenom'
        };
        
      case 'conseiller':
        return {
          client: 'nom prenom email telephone',
          conseiller: 'nom prenom',
          responsable: 'nom prenom'
        };
        
      default: // client
        return baseFields;
    }
  }
  
  getStatsParDefaut() {
    return {
      total: 0,
      montantTotal: 0,
      montantAutoriseTotal: 0,
      validees: 0,
      refusees: 0,
      annulees: 0,
      enCours: 0,
      nonRegularisees: 0,
      enRetard: 0,
      tauxValidation: 0,
      tauxRefus: 0,
      tauxRegularisation: 0
    };
  }
  
  // ==================== MÉTHODES SUPPLÉMENTAIRES ====================
  
  async getDemandesEnRetard() {
    return await DemandeForçage.find({
      statut: 'VALIDEE',
      regularisee: false,
      dateEcheance: { $lt: new Date() }
    })
    .populate('clientId', 'nom prenom email telephone')
    .populate('conseillerId', 'nom prenom email')
    .sort({ dateEcheance: 1 });
  }
  
  async getStatistiquesParAgence() {
    return await DemandeForçage.aggregate([
      {
        $group: {
          _id: '$agenceId',
          total: { $sum: 1 },
          validees: { $sum: { $cond: [{ $eq: ['$statut', 'VALIDEE'] }, 1, 0] } },
          refusees: { $sum: { $cond: [{ $eq: ['$statut', 'REFUSEE'] }, 1, 0] } },
          montantTotal: { $sum: '$montant' },
          montantAutoriseTotal: { $sum: '$montantAutorise' },
          enRetard: { $sum: { $cond: [{ $and: [{ $eq: ['$statut', 'VALIDEE'] }, { $eq: ['$regularisee', false] }, { $lt: ['$dateEcheance', new Date()] }] }, 1, 0] } }
        }
      },
      {
        $addFields: {
          tauxValidation: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$validees', '$total'] }, 100] }, 0] }
        }
      },
      { $sort: { total: -1 } }
    ]);
  }
  
  async ajouterPieceJustificative(demandeId, pieceData) {
    const demande = await DemandeForçage.findById(demandeId);
    
    if (!demande) throw new Error('Demande introuvable');
    
    demande.piecesJustificatives.push({
      ...pieceData,
      uploadedAt: new Date()
    });
    
    await demande.save();
    return demande;
  }

  // ==================== GÉNÉRATION NUMÉRO DE RÉFÉRENCE ====================
  async genererNumeroReference() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Compter les demandes du mois pour avoir un numéro séquentiel
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await DemandeForçage.countDocuments({
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    let numeroReference = `DF${year}${month}${sequence}`;
    
    // Vérifier l'unicité (au cas où)
    let attempts = 0;
    while (attempts < 10) {
      const existing = await DemandeForçage.findOne({ numeroReference });
      if (!existing) break;
      
      attempts++;
      const newSequence = String(count + 1 + attempts).padStart(4, '0');
      numeroReference = `DF${year}${month}${newSequence}`;
    }
    
    return numeroReference;
  }
}

module.exports = new DemandeForçageService();