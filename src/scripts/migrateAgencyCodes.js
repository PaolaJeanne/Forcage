// scripts/migrateAgencyCodes.js
const mongoose = require('mongoose');
const Agency = require('../src/models/Agency');
require('dotenv').config();

async function migrateAgencyCodes() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/credit_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('📡 Connexion à MongoDB établie');

    // Définir les codes pour les agences existantes
    const agenciesData = [
      { name: 'Agence Centre', code: 'CENTRE' },
      { name: 'Agence Nord', code: 'NORD' },
      { name: 'Agence Sud', code: 'SUD' },
      { name: 'Agence Ouest', code: 'OUEST' },
      { name: 'Agence Est', code: 'EST' },
      { name: 'Siège Principal', code: 'SIEGE' },
      { name: 'Agence Internationale', code: 'INTER' }
    ];

    let updatedCount = 0;
    let createdCount = 0;

    for (const agencyData of agenciesData) {
      try {
        // Chercher l'agence par nom
        let agency = await Agency.findOne({ name: agencyData.name });
        
        if (agency) {
          // Mettre à jour l'agence existante
          agency.code = agencyData.code;
          await agency.save();
          updatedCount++;
          console.log(`✅ Agence "${agency.name}" mise à jour avec code: ${agency.code}`);
        } else {
          // Créer une nouvelle agence si elle n'existe pas
          agency = new Agency({
            name: agencyData.name,
            code: agencyData.code,
            description: `${agencyData.name} - Agence principale`,
            region: getRegionFromName(agencyData.name),
            city: 'Yaoundé',
            address: 'Adresse principale',
            phone: '+237 222 222 222',
            email: `${agencyData.code.toLowerCase()}@creditapp.cm`,
            isActive: true
          });
          
          await agency.save();
          createdCount++;
          console.log(`🆕 Agence "${agency.name}" créée avec code: ${agency.code}`);
        }
      } catch (error) {
        console.error(`❌ Erreur sur l'agence "${agencyData.name}":`, error.message);
      }
    }

    console.log('\n📊 Résumé de la migration:');
    console.log(`✅ ${updatedCount} agences mises à jour`);
    console.log(`🆕 ${createdCount} agences créées`);
    console.log('🎉 Migration terminée avec succès !');

    // Afficher toutes les agences
    const allAgencies = await Agency.find({}, 'name code region isActive');
    console.log('\n📋 Liste des agences:');
    console.table(allAgencies.map(a => ({
      Nom: a.name,
      Code: a.code,
      Région: a.region || 'Non définie',
      Statut: a.isActive ? 'Actif' : 'Inactif'
    })));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur de migration:', error);
    process.exit(1);
  }
}

// Fonction utilitaire pour déterminer la région
function getRegionFromName(name) {
  if (name.includes('Centre')) return 'Centre';
  if (name.includes('Nord')) return 'Nord';
  if (name.includes('Sud')) return 'Sud';
  if (name.includes('Ouest')) return 'Ouest';
  if (name.includes('Est')) return 'Est';
  return 'National';
}

migrateAgencyCodes();