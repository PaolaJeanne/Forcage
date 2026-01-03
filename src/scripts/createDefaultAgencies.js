// src/scripts/createAgenciesAtlas.js
const mongoose = require('mongoose');
require('dotenv').config(); // Pour charger les variables d'environnement

async function createAgenciesAtlas() {
  try {
    console.log('☁️ Connexion à MongoDB Atlas...\n');
    
    // Utiliser l'URI de votre .env
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://paolajeannemoukodi_db_user:JegxUk3xvlxackDu@cluster0.ou54tmp.mongodb.net/forcing_db';
    
    console.log(`🔗 Connexion à: ${MONGODB_URI.split('@')[1]}...`); // Masquer les credentials
    
    await mongoose.connect(MONGODB_URI, {
      // Options pour MongoDB Atlas
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    
    console.log('✅ Connecté à MongoDB Atlas\n');
    
    // Importer les modèles
    const Agency = require('../models/Agency');
    const User = require('../models/User');
    
    // 1. Vérifier les agences existantes
    const agencyCount = await Agency.countDocuments();
    console.log(`📊 ${agencyCount} agences existent déjà\n`);
    
    if (agencyCount === 0) {
      console.log('📝 Création des agences dans MongoDB Atlas...\n');
      
      // Créer les agences
      const agencies = [
        {
          name: 'Siège',
          description: 'Direction générale et administration centrale',
          region: 'Île-de-France',
          city: 'Paris',
          address: '1 Avenue de la Banque, 75001 Paris',
          phone: '+33 1 23 45 67 89',
          email: 'siege@banque.fr',
          code: 'SIEGE',
          isActive: true
        },
        {
          name: 'Agence Centre',
          description: 'Agence régionale Centre-Val de Loire',
          region: 'Centre-Val de Loire',
          city: 'Orléans',
          address: '10 Rue des Commerces, 45000 Orléans',
          phone: '+33 2 38 54 76 90',
          email: 'centre@banque.fr',
          code: 'CENTRE',
          isActive: true
        },
        {
          name: 'Agence Sud',
          description: 'Agence régionale Provence-Alpes-Côte d\'Azur',
          region: 'PACA',
          city: 'Marseille',
          address: '25 Boulevard du Port, 13002 Marseille',
          phone: '+33 4 91 23 45 67',
          email: 'sud@banque.fr',
          code: 'SUD',
          isActive: true
        }
      ];
      
      const createdAgencies = await Agency.insertMany(agencies);
      
      console.log('✅ AGENCES CRÉÉES DANS MONGODB ATLAS:\n');
      createdAgencies.forEach(agency => {
        console.log(`  🏢 ${agency.name}`);
        console.log(`    ID: ${agency._id}`);
        console.log(`    Code: ${agency.code}`);
        console.log(`    Ville: ${agency.city}`);
        console.log('');
      });
      
    } else {
      console.log('ℹ️ Agences déjà existantes dans Atlas:\n');
      const agencies = await Agency.find({});
      agencies.forEach(agency => {
        console.log(`  🏢 ${agency.name} (${agency._id})`);
      });
    }
    
    // 2. Vérifier les utilisateurs
    console.log('\n👥 VÉRIFICATION DES UTILISATEURS:');
    const users = await User.find({});
    console.log(`📊 ${users.length} utilisateurs trouvés\n`);
    
    users.forEach(user => {
      console.log(`  👤 ${user.email} (${user.role})`);
      console.log(`    Nom: ${user.nom} ${user.prenom}`);
      console.log(`    Agence: ${user.agence || 'Non assigné'}`);
      console.log('');
    });
    
    // 3. Assigner les utilisateurs à l'agence Siège
    console.log('🔗 ASSIGNATION DES UTILISATEURS À L\'AGENCE SIÈGE...\n');
    
    const siegeAgency = await Agency.findOne({ name: 'Siège' });
    
    if (siegeAgency) {
      let assignedCount = 0;
      
      for (const user of users) {
        // Mettre à jour l'agence de l'utilisateur
        user.agence = 'Siège';
        await user.save();
        
        // Ajouter l'utilisateur comme conseiller de l'agence
        const isAlreadyConseiller = siegeAgency.conseillers.some(
          c => c.userId.toString() === user._id.toString()
        );
        
        if (!isAlreadyConseiller) {
          siegeAgency.conseillers.push({ userId: user._id });
          assignedCount++;
        }
      }
      
      await siegeAgency.save();
      console.log(`✅ ${assignedCount} utilisateurs assignés à l'agence Siège`);
    }
    
    // 4. Vérification finale
    console.log('\n🎯 VÉRIFICATION FINALE:\n');
    
    // Agences avec stats
    const agenciesWithStats = await Agency.find({}).populate('conseillers.userId', 'email role');
    
    agenciesWithStats.forEach(agency => {
      console.log(`  🏢 ${agency.name} (${agency.code})`);
      console.log(`    Conseillers: ${agency.conseillers.length}`);
      if (agency.conseillers.length > 0) {
        agency.conseillers.forEach(cons => {
          if (cons.userId) {
            console.log(`      - ${cons.userId.email} (${cons.userId.role})`);
          }
        });
      }
      console.log('');
    });
    
    await mongoose.disconnect();
    console.log('🎉 Script terminé avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
    
    // Vérifier la connexion
    if (error.name === 'MongoServerSelectionError') {
      console.log('\n⚠️ Problème de connexion à MongoDB Atlas');
      console.log('Vérifiez:');
      console.log('1. Votre connexion internet');
      console.log('2. L\'URI MongoDB dans .env');
      console.log('3. Les permissions sur MongoDB Atlas');
    }
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  createAgenciesAtlas();
}

module.exports = createAgenciesAtlas;