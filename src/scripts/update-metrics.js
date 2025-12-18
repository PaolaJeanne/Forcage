// src/scripts/update-metrics.js
const DashboardService = require('../services/dashboard.service');
const Metric = require('../models/Metric');
const logger = require('../utils/logger');

async function updateMetrics() {
  try {
    console.log('📊 Mise à jour des métriques...');
    
    const metrics = [
      // KPIs globaux
      { 
        nom: 'demandes_total', 
        categorie: 'demande',
        getValue: async () => await DemandeForçage.countDocuments() 
      },
      { 
        nom: 'demandes_en_cours', 
        categorie: 'demande',
        getValue: async () => await DemandeForçage.countDocuments({ 
          statut: { $in: ['SOUMISE', 'EN_COURS'] } 
        })
      },
      { 
        nom: 'taux_validation', 
        categorie: 'performance',
        getValue: async () => {
          const total = await DemandeForçage.countDocuments();
          const validees = await DemandeForçage.countDocuments({ statut: 'VALIDEE' });
          return total > 0 ? (validees / total) * 100 : 0;
        }
      },
      { 
        nom: 'montant_total', 
        categorie: 'financier',
        getValue: async () => {
          const result = await DemandeForçage.aggregate([
            { $group: { _id: null, total: { $sum: '$montant' } } }
          ]);
          return result[0]?.total || 0;
        }
      },
      { 
        nom: 'clients_actifs', 
        categorie: 'client',
        getValue: async () => {
          const result = await DemandeForçage.aggregate([
            { $group: { _id: '$clientId' } },
            { $count: 'total' }
          ]);
          return result[0]?.total || 0;
        }
      }
    ];
    
    // Mettre à jour chaque métrique
    for (const metric of metrics) {
      try {
        const valeur = await metric.getValue();
        
        await Metric.findOneAndUpdate(
          { nom: metric.nom },
          { 
            valeur,
            categorie: metric.categorie,
            periode: 'realtime',
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
        
        console.log(`✅ Métrique ${metric.nom}: ${valeur}`);
        
      } catch (error) {
        console.error(`❌ Erreur métrique ${metric.nom}:`, error.message);
      }
    }
    
    logger.info('📊 Métriques mises à jour avec succès');
    
  } catch (error) {
    logger.error('Erreur mise à jour métriques:', error);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  require('../config/db.config'); // Assurer la connexion DB
  updateMetrics().then(() => {
    console.log('📊 Script de mise à jour des métriques terminé');
    process.exit(0);
  });
}

module.exports = updateMetrics;