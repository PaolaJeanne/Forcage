// src/services/dashboard.service.js - VERSION CORRIGÉE
const DemandeForçage = require('../models/DemandeForçage');

class DashboardService {

  static async getFilteredKPIs(query, role) {
    try {


      const kpis = {
        demandesTotal: 0,
        demandesEnCours: 0,
        tauxValidation: 0,
        montantTotal: 0,
        clientsActifs: 0,
        montantMoyen: 0,
        tempsTraitementMoyen: 0
      };

      // Compter selon les filtres
      const [total, enCours, validees] = await Promise.all([
        DemandeForçage.countDocuments(query),
        DemandeForçage.countDocuments({ ...query, statut: { $in: ['SOUMISE', 'EN_COURS'] } }),
        DemandeForçage.countDocuments({ ...query, statut: 'VALIDEE' })
      ]);

      kpis.demandesTotal = total;
      kpis.demandesEnCours = enCours;
      kpis.tauxValidation = total > 0 ? Math.round((validees / total) * 100) : 0;

      // Agréger le montant total
      const montantAgg = await DemandeForçage.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$montant' } } }
      ]);

      kpis.montantTotal = montantAgg[0]?.total || 0;
      kpis.montantMoyen = total > 0 ? Math.round(kpis.montantTotal / total) : 0;

      // Clients actifs (distincts)
      const clientsActifs = await DemandeForçage.distinct('client', query);
      kpis.clientsActifs = clientsActifs.length;

      return kpis;

    } catch (error) {

      throw error;
    }
  }

  static async getFilteredStats(user, filters = {}) {
    try {
      let query = this.buildQueryForRole(user, filters);

      const stats = {
        demandesParStatut: [],
        demandesParRisque: [],
        evolutionMensuelle: [],
        topConseillers: [],
        topClients: []
      };

      // Statistiques par statut
      stats.demandesParStatut = await DemandeForçage.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$statut',
            count: { $sum: 1 },
            montantTotal: { $sum: '$montant' },
            montantMoyen: { $avg: '$montant' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Statistiques par score de risque (si accessible)
      if (['admin', 'dga', 'risques', 'rm', 'dce', 'adg'].includes(user.role)) {
        stats.demandesParRisque = await DemandeForçage.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$scoreRisque',
              count: { $sum: 1 },
              montantMoyen: { $avg: '$montant' }
            }
          },
          { $sort: { '_id': 1 } }
        ]);
      }

      // Évolution mensuelle
      stats.evolutionMensuelle = await DemandeForçage.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            montantTotal: { $sum: '$montant' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]);

      // Top conseillers (si accessible)
      if (['admin', 'dga', 'risques', 'rm', 'dce', 'adg'].includes(user.role)) {
        stats.topConseillers = await DemandeForçage.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$conseiller',
              count: { $sum: 1 },
              montantTotal: { $sum: '$montant' },
              tauxValidation: {
                $avg: {
                  $cond: [{ $eq: ['$statut', 'VALIDEE'] }, 1, 0]
                }
              }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]);
      }

      return stats;

    } catch (error) {

      throw error;
    }
  }

  // Statistiques de base (pour tous les rôles)
  static async getBasicStats(query, role) {
    const stats = {
      demandesParStatut: [],
      demandesParType: []
    };

    // Par statut
    stats.demandesParStatut = await DemandeForçage.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$statut',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Par type
    stats.demandesParType = await DemandeForçage.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$typeOperation',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return stats;
  }

  // Statistiques avancées (RM et +)
  static async getAdvancedStats(query, role) {
    const stats = await this.getBasicStats(query, role);

    // Ajouter des métriques avancées

    // Temps moyen de traitement
    const tempsTraitement = await DemandeForçage.aggregate([
      { $match: { ...query, dateTraitement: { $exists: true } } },
      {
        $project: {
          duree: {
            $subtract: ['$dateTraitement', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          moyenneMs: { $avg: '$duree' }
        }
      }
    ]);

    stats.tempsTraitementMoyen = tempsTraitement[0]
      ? Math.round(tempsTraitement[0].moyenneMs / (1000 * 60 * 60)) // Convertir en heures
      : 0;

    return stats;
  }

  // Statistiques de risque (Risques, ADG, DGA, Admin)
  static async getRiskStats(query, role) {
    const stats = {
      parScoreRisque: [],
      demandesRisqueEleve: 0,
      montantTotalRisque: 0,
      alertes: []
    };

    // Par score de risque
    stats.parScoreRisque = await DemandeForçage.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$scoreRisque',
          count: { $sum: 1 },
          montantTotal: { $sum: '$montant' },
          montantMoyen: { $avg: '$montant' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Demandes à risque élevé ou critique
    const risqueEleve = await DemandeForçage.countDocuments({
      ...query,
      scoreRisque: { $in: ['ELEVE', 'CRITIQUE'] },
      statut: { $in: ['ENVOYEE', 'EN_ETUDE', 'EN_VALIDATION'] }
    });

    stats.demandesRisqueEleve = risqueEleve;

    // Montant total des demandes à risque
    const montantRisque = await DemandeForçage.aggregate([
      {
        $match: {
          ...query,
          scoreRisque: { $in: ['ELEVE', 'CRITIQUE'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$montant' }
        }
      }
    ]);

    stats.montantTotalRisque = montantRisque[0]?.total || 0;

    // Alertes (demandes en retard)
    stats.alertes = await DemandeForçage.find({
      ...query,
      statut: 'VALIDEE',
      regularisee: false,
      dateEcheance: { $lt: new Date() }
    })
      .limit(10)
      .populate('clientId', 'nom prenom email')
      .lean();

    return stats;
  }

  // Statistiques globales (Admin, DGA)
  static async getGlobalStats() {
    const stats = {
      totalDemandes: 0,
      totalMontant: 0,
      parAgence: [],
      performanceGlobale: {}
    };

    // Total général
    const totaux = await DemandeForçage.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          montantTotal: { $sum: '$montant' }
        }
      }
    ]);

    if (totaux.length > 0) {
      stats.totalDemandes = totaux[0].total;
      stats.totalMontant = totaux[0].montantTotal;
    }

    // Par agence
    stats.parAgence = await DemandeForçage.aggregate([
      {
        $group: {
          _id: '$agenceId',
          total: { $sum: 1 },
          montantTotal: { $sum: '$montant' },
          validees: {
            $sum: {
              $cond: [{ $eq: ['$statut', 'VALIDEE'] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          tauxValidation: {
            $multiply: [{ $divide: ['$validees', '$total'] }, 100]
          }
        }
      },
      { $sort: { montantTotal: -1 } },
      { $limit: 10 }
    ]);

    return stats;
  }

  // Activités récentes avec limite
  static async getRecentActivities(query, role, limit = 10) {
    const demandes = await DemandeForçage.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('clientId', 'nom prenom email')
      .populate('conseillerId', 'nom prenom')
      .lean();

    return demandes.map(d => ({
      id: d._id,
      numeroReference: d.numeroReference,
      statut: d.statut,
      typeOperation: d.typeOperation,
      montant: d.montant,
      client: d.clientId ? {
        nom: d.clientId.nom,
        prenom: d.clientId.prenom,
        email: role !== 'client' ? d.clientId.email : undefined
      } : null,
      conseiller: d.conseillerId ? {
        nom: d.conseillerId.nom,
        prenom: d.conseillerId.prenom
      } : null,
      scoreRisque: ['rm', 'dce', 'adg', 'dga', 'admin', 'risques'].includes(role) ? d.scoreRisque : undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));
  }

  // Helper pour construire la query selon le rôle
  static buildQueryForRole(user, filters = {}) {
    let query = {};

    // Base selon le rôle
    switch (user.role) {
      case 'admin':
      case 'dga':
      case 'risques':
        // Toutes les données
        break;

      case 'client':
        query.client = user._id || user.id;
        break;

      case 'conseiller':
        query.$or = [
          { conseiller: user._id || user.id },
          { agence: user.agence }
        ];
        break;

      case 'rm':
      case 'dce':
      case 'adg':
        query.agence = user.agence;
        break;

      default:
        query.client = user._id || user.id;
    }

    // Appliquer les filtres additionnels
    if (filters.statut) query.statut = filters.statut;
    if (filters.typeOperation) query.typeOperation = filters.typeOperation;
    if (filters.scoreRisque) query.scoreRisque = { $gte: filters.scoreRisque };
    if (filters.dateDebut || filters.dateFin) {
      query.createdAt = {};
      if (filters.dateDebut) query.createdAt.$gte = new Date(filters.dateDebut);
      if (filters.dateFin) query.createdAt.$lte = new Date(filters.dateFin);
    }

    return query;
  }

  // Ajoutez cette méthode
  static async getDashboardData(user, filters = {}) {
    try {


      const query = this.buildQueryForRole(user, filters);

      // Récupérer toutes les données en parallèle
      const [kpis, stats, recentActivities] = await Promise.all([
        this.getFilteredKPIs(query, user.role),
        this.getFilteredStats(user, filters),
        this.getRecentActivities(query, user.role, 5)
      ]);

      // Construire la réponse complète
      const dashboardData = {
        user: {
          id: user._id || user.id,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          agence: user.agence,
          email: user.email
        },
        kpis,
        stats,
        recentActivities,
        filters: {
          applied: filters,
          available: this.getAvailableFilters(user.role)
        },
        generatedAt: new Date(),
        accessLevel: this.getAccessLevel(user.role)
      };

      // Ajouter des données supplémentaires selon le rôle
      if (['admin', 'dga', 'risques'].includes(user.role)) {
        const globalStats = await this.getGlobalStats();
        dashboardData.globalStats = globalStats;
      }

      if (['admin', 'dga', 'risques', 'rm', 'dce', 'adg'].includes(user.role)) {
        const riskStats = await this.getRiskStats(query, user.role);
        dashboardData.riskStats = riskStats;
      }

      return dashboardData;

    } catch (error) {

      throw error;
    }
  }

  // ... autres méthodes existantes

  // Ajoutez ces méthodes helpers
  static getAvailableFilters(role) {
    const filters = [
      {
        key: 'periode',
        label: 'Période',
        type: 'select',
        options: [
          { value: 'today', label: "Aujourd'hui" },
          { value: 'week', label: 'Cette semaine' },
          { value: 'month', label: 'Ce mois' },
          { value: 'quarter', label: 'Ce trimestre' }
        ]
      },
      {
        key: 'statut',
        label: 'Statut',
        type: 'multi-select',
        options: [
          { value: 'BROUILLON', label: 'Brouillon' },
          { value: 'SOUMISE', label: 'Soumise' },
          { value: 'EN_COURS', label: 'En cours' },
          { value: 'VALIDEE', label: 'Validée' },
          { value: 'REFUSEE', label: 'Refusée' }
        ]
      }
    ];

    if (['admin', 'dga', 'risques'].includes(role)) {
      filters.push(
        { key: 'agenceId', label: 'Agence', type: 'select', dynamic: true },
        { key: 'conseillerId', label: 'Conseiller', type: 'select', dynamic: true }
      );
    }

    if (role !== 'client') {
      filters.push(
        { key: 'clientId', label: 'Client', type: 'select', dynamic: true }
      );
    }

    return filters;
  }

  static getAccessLevel(role) {
    const levels = {
      'client': 'personal',
      'conseiller': 'conseiller',
      'rm': 'agence_supervisor',
      'dce': 'agence_manager',
      'adg': 'regional',
      'dga': 'national',
      'risques': 'risk_management',
      'admin': 'global'
    };

    return levels[role] || 'restricted';
  }
}

module.exports = DashboardService;