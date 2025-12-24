// scripts/fix-chatarchive.js
require('dotenv').config();
const mongoose = require('mongoose');

async function fixChatArchiveIndexes() {
  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/force-management';
    
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');
    
    // Vider le cache du modèle pour le recharger proprement
    delete mongoose.models.ChatArchive;
    delete mongoose.modelSchemas.ChatArchive;
    
    // Recharger le modèle corrigé
    const ChatArchive = require('../src/models/ChatArchive');
    
    console.log('\n📊 Vérification des index actuels...');
    const currentIndexes = await ChatArchive.collection.getIndexes();
    
    console.log(`Nombre d'index actuels: ${Object.keys(currentIndexes).length}`);
    Object.keys(currentIndexes).forEach(index => {
      console.log(`  • ${index}`);
    });
    
    // Vérifier s'il y a des index dupliqués pour expiresAt
    const expiresAtIndexes = Object.keys(currentIndexes).filter(name => 
      name.includes('expiresAt')
    );
    
    if (expiresAtIndexes.length > 1) {
      console.log(`\n⚠️  ${expiresAtIndexes.length} index expiresAt détectés!`);
      
      // Garder seulement l'index avec TTL
      for (const indexName of expiresAtIndexes) {
        if (indexName !== 'expiresAt_1') {
          console.log(`🗑️  Suppression de l'index dupliqué: ${indexName}`);
          await ChatArchive.collection.dropIndex(indexName);
        }
      }
    }
    
    console.log('\n🔄 Synchronisation des index avec le schéma corrigé...');
    await ChatArchive.syncIndexes();
    
    console.log('\n✅ Vérification des nouveaux index...');
    const newIndexes = await ChatArchive.collection.getIndexes();
    console.log(`Nombre d'index après synchronisation: ${Object.keys(newIndexes).length}`);
    Object.keys(newIndexes).forEach(index => {
      const indexInfo = newIndexes[index];
      const ttl = indexInfo.expireAfterSeconds ? ` (TTL: ${indexInfo.expireAfterSeconds}s)` : '';
      console.log(`  • ${index}${ttl}`);
    });
    
    console.log('\n🎉 ChatArchive corrigé avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.code === 85) {
      console.log('💡 Erreur: Index déjà existant avec options différentes');
      console.log('   Essayez de supprimer manuellement les index:');
      console.log('   1. Connectez-vous à MongoDB Compass');
      console.log('   2. Allez dans la collection "chatarchives"');
      console.log('   3. Dans l\'onglet "Indexes", supprimez tous les index sauf "_id_"');
      console.log('   4. Relancez ce script');
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('🔌 Déconnecté de MongoDB');
    }
  }
}

fixChatArchiveIndexes();