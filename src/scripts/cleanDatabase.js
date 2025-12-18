// src/scripts/cleanDatabase.js - VERSION AVEC CONFIG
const mongoose = require('mongoose');
const path = require('path');

// Ajustez le chemin selon votre structure
// Si config/database.js est dans src/config/
const connectDB = require('../config/database');

async function cleanDatabase() {
  try {
    console.log('🧹 Début du nettoyage de la base de données...');
    
    // Utiliser votre fonction de connexion existante
    await connectDB();
    
    console.log('✅ Connecté à MongoDB');
    
    // Obtenir la liste des collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log(`📊 ${collections.length} collections trouvées`);
    
    // Nettoyer chaque collection (sauf les collections système)
    for (let collection of collections) {
      const collectionName = collection.name;
      
      // Éviter les collections système
      if (!collectionName.startsWith('system.')) {
        console.log(`🗑️  Suppression de: ${collectionName}`);
        const result = await db.collection(collectionName).deleteMany({});
        console.log(`   📝 ${result.deletedCount} documents supprimés`);
      }
    }
    
    console.log('✅ Base de données nettoyée avec succès!');
    
    // Fermer la connexion
    await mongoose.connection.close();
    console.log('🔌 Connexion fermée');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  }
}

// Exécuter le script
cleanDatabase();