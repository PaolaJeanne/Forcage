// ============================================
// src/services/dashboard.service.js - VERSION COMPLÈTE UNIFIÉE
// ============================================
const DemandeForçage = require('../models/DemandeForçage');
const User = require('../models/User');
const { STATUTS_DEMANDE } = require('../constants/roles');
const mongoose = require('mongoose');

class DashboardService {

  // ==================== KPIs & OVERVIEW ====================

  static async getFilteredKPIs(query, role) {
    try {
      const kpis = {
        demandesTotal: 0,
        demandesEnCours: 0,
        demandesApprouvees: 0,
        demandesRejetees: 0,
        tauxValidation: 0,
        montantTotal: 0,
        montantApprouve: 0,
        montantMoyen: 0,
        clientsActifs: 0,
        tempsTraitementMoyen: 0
      };

      const statutsEnCours = [
        STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
        STATUTS_DEMANDE.EN_ETUDE_CONSEILLER,
        STATUTS_DEMANDE.EN_ATTENTE_RM,
        STATUTS_DEMANDE.EN_ATTENTE_DCE,
        STATUTS_DEMANDE.EN_ATTENTE_ADG,
        STATUTS_DEMANDE.EN_ANALYSE_RISQUES
      ];

      // Compter les demandes
      const [total, enCours, approuvees, rejetees] = await Promise.all([
        DemandeForçage.countDocuments(query),
        DemandeForçage.countDocuments({ ...query, statut: { $in: statutsEnCours } }),
        DemandeForçage.countDocuments({ ...query, statut: STATUTS_DEMANDE.APPROUVEE }),
        DemandeForçage.countDocuments({ ...query, statut: STATUTS_DEMANDE.REJETEE })
      ]);

      kpis.demandesTotal = total;
      kpis.demandesEnCours = enCours;
      kpis.demandesApprouvees = approuvees;
      kpis.demandesRejetees = rejetees;
      kpis.tauxValidation = total > 0 ? Math.round((approuvees / total) * 100) : 0;

      // Montants
      const [montantTotal, montantApprouve] = await Promise.all([
        DemandeForçage.aggregate([
          { $match: query },
          { $group: { _id: null, total: { $sum: '$montant' } } }
        ]),
        DemandeForçage.aggregate([
          { $match: { ...query, statut: STATUTS_DEMANDE.APPROUVEE } },
          { $group: { _id: null, total: { $sum: '$montantAutorise' } } }
        ])
      ]);

      kpis.montantTotal = montantTotal[0]?.total || 0;
      kpis.montantApprouve = montantApprouve[0]?.total || 0;
      kpis.montantMoyen = total > 0 ? Math.round(kpis.montantTotal / total) : 0;

      // Clients actifs
      const clientsActifs = await DemandeForçage.distinct('clientId', query);
      kpis.clientsActifs = clientsActifs.length;

      // Temps de traitement moyen
      const tempsTraitement = await DemandeForçage.aggregate([
        {
          $match: {
            ...query,
            statut: { $in: [STATUTS_DEMANDE.APPROUVEE, STATUTS_DEMANDE.REJETEE] },
            dateValidation: { $exists: true }
          }
        },
        {
          $project: {
            dureeHeures: {
              $divide: [
                { $subtract: ['$dateValidation', '$dateSoumission'] },
                1000 * 60 * 60
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            moyenne: { $avg: '$dureeHeures' }
          }
        }
      ]);

      kpis.tempsTraitementMoyen = tempsTraitement[0]?.moyenne
        ? Math.round(tempsTraitement[0].moyenne * 10) / 10
        : 0;

      return kpis;
    } catch (error) {
      throw error;
    }
  }

  // ==================== STATISTIQUES ====================

  static async getFilteredStats(user, filters = {}) {
    try {
      const query = this.buildQueryForRole(user, filters);

      const stats = {
        demandesParStatut: [],
        demandesParRisque: [],
        demandesParMontant: [],
        evolutionMensuelle: [],
        topConseillers: [],
        topClients: []
      };

      // Par statut
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

      // Par score de risque
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

      // Par tranches de montant
      stats.demandesParMontant = await this.getDistributionMontants(query);

      // Évolution mensuelle (12 derniers mois)
      stats.evolutionMensuelle = await DemandeForçage.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            montantTotal: { $sum: '$montant' },
            approuvees: {
              $sum: { $cond: [{ $eq: ['$statut', STATUTS_DEMANDE.APPROUVEE] }, 1, 0] }
            }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      // Top conseillers
      if (['admin', 'dga', 'risques', 'rm', 'dce', 'adg'].includes(user.role)) {
        stats.topConseillers = await DemandeForçage.aggregate([
          { $match: { ...query, conseillerId: { $exists: true } } },
          {
            $group: {
              _id: '$conseillerId',
              count: { $sum: 1 },
              montantTotal: { $sum: '$montant' },
              approuvees: {
                $sum: { $cond: [{ $eq: ['$statut', STATUTS_DEMANDE.APPROUVEE] }, 1, 0] }
              }
            }
          },
          {
            $addFields: {
              tauxApprobation: {
                $multiply: [{ $divide: ['$approuvees', '$count'] }, 100]
              }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'conseiller'
            }
          },
          { $unwind: { path: '$conseiller', preserveNullAndEmptyArrays: true } }
        ]);
      }

      // Top clients
      if (user.role !== 'client') {
        stats.topClients = await DemandeForçage.aggregate([
          { $match: { ...query, clientId: { $exists: true } } },
          {
            $group: {
              _id: '$clientId',
              count: { $sum: 1 },
              montantTotal: { $sum: '$montant' }
            }
          },
          { $sort: { montantTotal: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'client'
            }
          },
          { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } }
        ]);
      }

      return stats;
    } catch (error) {
      throw error;
    }
  }

  // ==================== DISTRIBUTION MONTANTS ====================

  static async getDistributionMontants(query) {
    const demandes = await DemandeForçage.find(query).select('montant statut');

    const tranches = [
      { min: 0, max: 1000000, label: '< 1M FCFA' },
      { min: 1000000, max: 5000000, label: '1M - 5M FCFA' },
      { min: 5000000, max: 20000000, label: '5M - 20M FCFA' },
      { min: 20000000, max: 50000000, label: '20M - 50M FCFA' },
      { min: 50000000, max: Infinity, label: '> 50M FCFA' }
    ];

    return tranches.map(tranche => {
      const demandesTranche = demandes.filter(d =>
        d.montant >= tranche.min && d.montant < tranche.max
      );

      return {
        tranche: tranche.label,
        count: demandesTranche.length,
        approuvees: demandesTranche.filter(d => d.statut === STATUTS_DEMANDE.APPROUVEE).length,
        montantTotal: demandesTranche.reduce((sum, d) => sum + d.montant, 0)
      };
    });
  }

  // ==================== ALERTES ====================

  static async getAlertes(query, role) {
    const demandes = await DemandeForçage.find(query)
      .populate('clientId', 'nom prenom email')
      .populate('conseillerId', 'nom prenom')
      .lean();

    const alertes = [];

    demandes.forEach(demande => {
      // Retard de traitement
      if (demande.enRetard) {
        alertes.push({
          type: 'retard',
          severity: 'high',
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          message: 'Demande en retard de traitement',
          statut: demande.statut
        });
      }

      // Montant élevé non traité
      if (demande.montant >= 10000000 &&
        ![STATUTS_DEMANDE.APPROUVEE, STATUTS_DEMANDE.REJETEE].includes(demande.statut)) {
        alertes.push({
          type: 'montant_eleve',
          severity: 'medium',
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          message: `Montant élevé (${(demande.montant / 1000000).toFixed(1)}M) en attente`,
          montant: demande.montant
        });
      }

      // Échéance proche
      const joursRestants = Math.ceil((new Date(demande.dateEcheance) - new Date()) / (1000 * 60 * 60 * 24));
      if (joursRestants <= 3 && joursRestants > 0 && demande.statut !== STATUTS_DEMANDE.APPROUVEE) {
        alertes.push({
          type: 'echeance_proche',
          severity: 'medium',
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          message: `Échéance dans ${joursRestants} jour(s)`,
          dateEcheance: demande.dateEcheance
        });
      }
    });

    return alertes.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  // ==================== ACTIVITÉS RÉCENTES ====================

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

  // ==================== STATISTIQUES GLOBALES ====================

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
          approuvees: {
            $sum: { $cond: [{ $eq: ['$statut', STATUTS_DEMANDE.APPROUVEE] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          tauxValidation: {
            $multiply: [{ $divide: ['$approuvees', '$total'] }, 100]
          }
        }
      },
      { $sort: { montantTotal: -1 } },
      { $limit: 10 }
    ]);

    return stats;
  }

  // ==================== BUILD QUERY ====================

  static buildQueryForRole(user, filters = {}) {
    let query = {};

    const safelyObjectId = (id) => {
      try {
        return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
      } catch (e) {
        return id;
      }
    };

    const userId = safelyObjectId(user._id || user.id);

    // Base selon le rôle
    switch (user.role) {
      case 'admin':
      case 'dga':
      case 'risques':
        // Accès total
        break;

      case 'client':
        query.clientId = userId;
        break;

      case 'conseiller':
        query.$or = [
          { conseillerId: userId },
          { agenceId: user.agence || user.agenceId }
        ];
        break;

      case 'rm':
      case 'dce':
      case 'adg':
        if (user.agence || user.agenceId) {
          query.agenceId = user.agence || user.agenceId;
        }
        break;

      default:
        query.clientId = userId;
    }

    // Appliquer les filtres additionnels
    if (filters.statut) {
      query.statut = Array.isArray(filters.statut) ? { $in: filters.statut } : filters.statut;
    }
    if (filters.typeOperation) query.typeOperation = filters.typeOperation;
    if (filters.scoreRisque) query.scoreRisque = { $gte: filters.scoreRisque };
    if (filters.dateDebut || filters.dateFin) {
      query.createdAt = {};
      if (filters.dateDebut) query.createdAt.$gte = new Date(filters.dateDebut);
      if (filters.dateFin) query.createdAt.$lte = new Date(filters.dateFin);
    }
    if (filters.agenceId) query.agenceId = filters.agenceId;
    if (filters.conseillerId) query.conseillerId = safelyObjectId(filters.conseillerId);
    if (filters.clientId) query.clientId = safelyObjectId(filters.clientId);

    return query;
  }

  // ==================== DASHBOARD COMPLET ====================

  static async getDashboardData(user, filters = {}) {
    try {
      const query = this.buildQueryForRole(user, filters);

      // Récupérer toutes les données en parallèle
      const [kpis, stats, recentActivities, alertes] = await Promise.all([
        this.getFilteredKPIs(query, user.role),
        this.getFilteredStats(user, filters),
        this.getRecentActivities(query, user.role, 5),
        this.getAlertes(query, user.role)
      ]);

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
        alertes: alertes.slice(0, 5), // Top 5 alertes
        filters: {
          applied: filters,
          available: this.getAvailableFilters(user.role)
        },
        generatedAt: new Date(),
        accessLevel: this.getAccessLevel(user.role)
      };

      // Données additionnelles selon le rôle
      if (['admin', 'dga', 'risques'].includes(user.role)) {
        const globalStats = await this.getGlobalStats();
        dashboardData.globalStats = globalStats;
      }

      return dashboardData;
    } catch (error) {
      throw error;
    }
  }

  // ==================== HELPERS ====================

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
        options: Object.values(STATUTS_DEMANDE).map(s => ({ value: s, label: s }))
      }
    ];

    if (['admin', 'dga', 'risques'].includes(role)) {
      filters.push(
        { key: 'agenceId', label: 'Agence', type: 'select', dynamic: true },
        { key: 'conseillerId', label: 'Conseiller', type: 'select', dynamic: true }
      );
    }

    if (role !== 'client') {
      filters.push({ key: 'clientId', label: 'Client', type: 'select', dynamic: true });
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
