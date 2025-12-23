// src/scripts/init-workflow-data.js - SCRIPT D'INITIALISATION
const mongoose = require('mongoose');
require('dotenv').config();

async function initWorkflowData() {
  try {
    console.log('🚀 Initialisation des données workflow...');
    
    // Connexion
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'forcing_db'
    });
    
    console.log('✅ Connecté à MongoDB');
    
    const DemandeForçage = require('../models/DemandeForçage');
    const User = require('../models/User');
    const { STATUTS_DEMANDE, NOTATIONS_CLIENT, PRIORITES } = require('../constants/roles');
    
    // 1. Vérifier les utilisateurs existants
    const users = await User.find({}).select('email role agence').limit(5);
    console.log('👥 Utilisateurs trouvés:', users.map(u => `${u.email} (${u.role})`));
    
    // 2. Créer des demandes de test avec le nouveau workflow
    const testDemandes = [
      {
        numeroReference: 'DF2025120001',
        motif: 'Paiement fournisseur urgent - Matériel informatique',
        montant: 350000,
        typeOperation: 'VIREMENT',
        clientId: users.find(u => u.role === 'client')?._id,
        conseillerId: users.find(u => u.role === 'conseiller')?._id,
        agenceId: 'Agence Centrale',
        notationClient: 'B',
        statut: STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
        priorite: PRIORITES.URGENTE,
        scoreRisque: 'MOYEN',
        soldeActuel: 50000,
        decouvertAutorise: 100000,
        montantForçageTotal: 200000,
        dateEcheance: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2 jours
        piecesJustificatives: [
          {
            nom: 'facture_informatique.pdf',
            url: '/uploads/facture.pdf',
            type: 'application/pdf',
            taille: 1024000
          }
        ],
        historique: [
          {
            action: 'CREATION',
            statutAvant: null,
            statutApres: STATUTS_DEMANDE.BROUILLON,
            userId: users.find(u => u.role === 'client')?._id,
            commentaire: 'Demande créée',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          },
          {
            action: 'SOUMISSION',
            statutAvant: STATUTS_DEMANDE.BROUILLON,
            statutApres: STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
            userId: users.find(u => u.role === 'client')?._id,
            commentaire: 'Demande soumise pour traitement urgent',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      {
        numeroReference: 'DF2025120002',
        motif: 'Rénovation bureaux agence',
        montant: 2500000,
        typeOperation: 'VIREMENT',
        clientId: users.find(u => u.role === 'client')?._id,
        conseillerId: users.find(u => u.role === 'conseiller')?._id,
        agenceId: 'Agence Centrale',
        notationClient: 'C',
        statut: STATUTS_DEMANDE.EN_ATTENTE_RM,
        priorite: PRIORITES.HAUTE,
        scoreRisque: 'ELEVE',
        soldeActuel: 100000,
        decouvertAutorise: 500000,
        montantForçageTotal: 1900000,
        dateEcheance: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 jours
        piecesJustificatives: [
          {
            nom: 'devis_renovation.pdf',
            url: '/uploads/devis.pdf',
            type: 'application/pdf',
            taille: 2048000
          }
        ],
        historique: [
          {
            action: 'CREATION',
            statutAvant: null,
            statutApres: STATUTS_DEMANDE.BROUILLON,
            userId: users.find(u => u.role === 'client')?._id,
            commentaire: 'Demande créée',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          },
          {
            action: 'SOUMISSION',
            statutAvant: STATUTS_DEMANDE.BROUILLON,
            statutApres: STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
            userId: users.find(u => u.role === 'client')?._id,
            commentaire: 'Demande soumise',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          },
          {
            action: 'REMONTER',
            statutAvant: STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
            statutApres: STATUTS_DEMANDE.EN_ATTENTE_RM,
            userId: users.find(u => u.role === 'conseiller')?._id,
            commentaire: 'Montant > limite conseiller, remontée au RM',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      {
        numeroReference: 'DF2025120003',
        motif: 'Achat véhicule de service direction',
        montant: 8000000,
        typeOperation: 'VIREMENT',
        clientId: users.find(u => u.role === 'client')?._id,
        conseillerId: users.find(u => u.role === 'conseiller')?._id,
        agenceId: 'Agence Centrale',
        notationClient: 'A',
        statut: STATUTS_DEMANDE.APPROUVEE,
        priorite: PRIORITES.NORMALE,
        scoreRisque: 'MOYEN',
        soldeActuel: 2000000,
        decouvertAutorise: 1000000,
        montantForçageTotal: 5000000,
        montantAutorise: 8000000,
        dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
        piecesJustificatives: [
          {
            nom: 'contrat_vehicule.pdf',
            url: '/uploads/contrat.pdf',
            type: 'application/pdf',
            taille: 3072000
          }
        ],
        validePar_adg: {
          userId: users.find(u => u.role === 'adg')?._id,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          commentaire: 'Client fiable, projet validé'
        },
        historique: [
          {
            action: 'CREATION',
            statutAvant: null,
            statutApres: STATUTS_DEMANDE.BROUILLON,
            userId: users.find(u => u.role === 'client')?._id,
            commentaire: 'Demande créée',
            timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
          },
          {
            action: 'SOUMISSION',
            statutAvant: STATUTS_DEMANDE.BROUILLON,
            statutApres: STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
            userId: users.find(u => u.role === 'client')?._id,
            commentaire: 'Demande soumise',
            timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
          },
            {
            action: 'REMONTER',
            statutAvant: STATUTS_DEMANDE.EN_ATTENTE_CONSEILLER,
            statutApres: STATUTS_DEMANDE.EN_ATTENTE_RM,
            userId: users.find(u => u.role === 'conseiller')?._id,
            commentaire: 'Montant > limite conseiller, remontée au RM',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            },
            {
            action: 'APPROBATION',
            statutAvant: STATUTS_DEMANDE.EN_ATTENTE_ADG,
            statutApres: STATUTS_DEMANDE.APPROUVEE,
            userId: users.find(u => u.role === 'adg')?._id,
            commentaire: 'Demande approuvée par l\'ADG',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ]
      }
    ];
    await DemandeForçage.insertMany(testDemandes);
    console.log('✅ Demandes de test insérées avec succès');
    console.log('🚀 Initialisation terminée.')
    process.exit(0)
    } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation des données workflow:', error)
            process.exit(1)
            };
}

initWorkflowData();