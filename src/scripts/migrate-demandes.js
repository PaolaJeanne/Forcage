// src/scripts/migrate-demandes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function migrateDemandes() {
  try {
    console.log('🚀 Migration des demandes...');
    
    // Connexion
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'forcing_db'
    });
    
    console.log('✅ Connecté à MongoDB');
    
    const DemandeForçage = require('../models/DemandeForçage');
    const User = require('../models/User');
    
    // 1. Compter les demandes existantes
    const totalDemandes = await DemandeForçage.countDocuments();
    console.log(`📊 Total demandes: ${totalDemandes}`);
    
    // 2. Vérifier la structure des pièces justificatives existantes
    const demandesAvecPieces = await DemandeForçage.find({
      piecesJustificatives: { $exists: true, $ne: [] }
    });
    
    console.log(`📎 Demandes avec pièces justificatives: ${demandesAvecPieces.length}`);
    
    for (const demande of demandesAvecPieces) {
      try {
        const pieces = demande.piecesJustificatives;
        
        // Si pieces est une chaîne JSON, la parser
        if (typeof pieces === 'string') {
          try {
            const parsed = JSON.parse(pieces);
            demande.piecesJustificatives = Array.isArray(parsed) ? parsed : [parsed];
            await demande.save();
            console.log(`✅ Demande ${demande.numeroReference} corrigée (string → array)`);
          } catch (parseError) {
            // Si échec du parsing, créer un objet simple
            demande.piecesJustificatives = [{
              nom: 'Document joint',
              url: pieces,
              type: 'application/octet-stream',
              taille: 0,
              uploadedAt: new Date()
            }];
            await demande.save();
            console.log(`✅ Demande ${demande.numeroReference} corrigée (string → object)`);
          }
        }
        // Si pieces est un tableau de chaînes, convertir en objets
        else if (Array.isArray(pieces) && pieces.length > 0 && typeof pieces[0] === 'string') {
          const nouvellesPieces = pieces.map((piece, index) => ({
            nom: `Document ${index + 1}`,
            url: piece,
            type: 'application/octet-stream',
            taille: 0,
            uploadedAt: new Date()
          }));
          
          demande.piecesJustificatives = nouvellesPieces;
          await demande.save();
          console.log(`✅ Demande ${demande.numeroReference} corrigée (array strings → array objects)`);
        }
      } catch (error) {
        console.error(`❌ Erreur migration demande ${demande.numeroReference}:`, error.message);
      }
    }
    
    // 3. Créer des demandes de test si aucune n'existe
    if (totalDemandes === 0) {
      console.log('📝 Création de demandes de test...');
      
      // Trouver un client et un conseiller
      const client = await User.findOne({ role: 'client' });
      const conseiller = await User.findOne({ role: 'conseiller' });
      
      if (!client || !conseiller) {
        console.log('⚠️ Créer d\'abord des utilisateurs de test');
        return;
      }
      
      // Créer 5 demandes de test
      const testDemandes = [
        {
          numeroReference: 'DF2024120001',
          motif: 'Paiement fournisseur urgent - Matériel de bureau',
          montant: 450000,
          clientId: client._id,
          conseillerId: conseiller._id,
          agenceId: 'Agence Centrale',
          piecesJustificatives: [{
            nom: 'facture_materiel.pdf',
            url: '/uploads/facture.pdf',
            type: 'application/pdf',
            taille: 1024000,
            uploadedAt: new Date()
          }],
          dateEcheance: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          statut: 'EN_ATTENTE_CONSEILLER',
          priorite: 'URGENTE',
          scoreRisque: 'MOYEN'
        },
        {
          numeroReference: 'DF2024120002',
          motif: 'Rénovation locaux commerciaux',
          montant: 3500000,
          clientId: client._id,
          conseillerId: conseiller._id,
          agenceId: 'Agence Centrale',
          piecesJustificatives: [{
            nom: 'devis_renovation.pdf',
            url: '/uploads/devis.pdf',
            type: 'application/pdf',
            taille: 2048000,
            uploadedAt: new Date()
          }],
          dateEcheance: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          statut: 'EN_ATTENTE_RM',
          priorite: 'HAUTE',
          scoreRisque: 'ELEVE'
        },
        {
          numeroReference: 'DF2024120003',
          motif: 'Achat véhicule de service',
          montant: 8000000,
          clientId: client._id,
          conseillerId: conseiller._id,
          agenceId: 'Agence Centrale',
          piecesJustificatives: [{
            nom: 'contrat_vehicule.pdf',
            url: '/uploads/contrat.pdf',
            type: 'application/pdf',
            taille: 3072000,
            uploadedAt: new Date()
          }],
          dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          statut: 'APPROUVEE',
          priorite: 'NORMALE',
          scoreRisque: 'FAIBLE'
        }
      ];
      
      for (const demandeData of testDemandes) {
        const demande = new DemandeForçage(demandeData);
        await demande.save();
        console.log(`✅ Demande test créée: ${demandeData.numeroReference}`);
      }
    }
    
    console.log('🎉 Migration terminée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter la migration
if (require.main === module) {
  migrateDemandes();
}

module.exports = migrateDemandes;