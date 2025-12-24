// scripts/force-fix-chatarchive.js
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function forceFixChatArchive() {
  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const db = mongoose.connection.db;
    
    // Vérifier si la collection existe
    const collections = await db.listCollections({ name: 'chatarchives' }).toArray();
    
    if (collections.length === 0) {
      console.log('ℹ Collection "chatarchives" n\'existe pas');
      console.log('✅ Aucune action nécessaire');
      return;
    }
    
    console.log('🧹 NETTOYAGE FORCÉ DE CHATARCHIVE');
    console.log('='.repeat(50));
    
    // 1. Vider le cache Mongoose
    delete mongoose.models.ChatArchive;
    delete mongoose.modelSchemas.ChatArchive;
    
    // 2. Supprimer la collection complètement (si vous n'avez pas de données importantes)
    console.log('\n⚠️  Suppression de la collection chatarchives...');
    const userChoice = process.argv[2];
    
    if (userChoice === '--drop') {
      await db.collection('chatarchives').drop();
      console.log('✅ Collection supprimée');
      console.log('📝 Recréation de la collection avec index propres...');
      await db.createCollection('chatarchives');
    } else {
      console.log('ℹ Collection préservée (utilisez --drop pour la supprimer)');
      console.log('🗑️  Suppression uniquement des index...');
      try {
        await db.collection('chatarchives').dropIndexes();
        console.log('✅ Index supprimés');
      } catch (error) {
        console.log(`ℹ ${error.message}`);
      }
    }
    
    // 3. CORRECTION CRITIQUE: Modifier temporairement le modèle
    console.log('\n🔧 Correction du modèle ChatArchive.js...');
    
    // Créer un modèle temporaire avec les index CORRIGÉS
    const tempSchema = new mongoose.Schema({
      conversationId: { type: mongoose.Schema.Types.ObjectId, required: true },
      conversationData: mongoose.Schema.Types.Mixed,
      messages: [mongoose.Schema.Types.Mixed],
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      reason: { type: String, enum: ['auto', 'manual', 'compliance', 'cleanup'], default: 'manual' },
      archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      archivedAt: { type: Date, default: Date.now },
      expiresAt: Date,
      metadata: mongoose.Schema.Types.Mixed
    }, { timestamps: true });
    
    // UNIQUEMENT 5 index, PAS de doublon pour expiresAt!
    tempSchema.index({ conversationId: 1 });
    tempSchema.index({ archivedAt: -1 });
    tempSchema.index({ archivedBy: 1 });
    tempSchema.index({ reason: 1, archivedAt: -1 });
    // UN SEUL index expiresAt avec TTL
    tempSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    
    const TempChatArchive = mongoose.model('TempChatArchive', tempSchema, 'chatarchives');
    
    // 4. Créer les index
    console.log('🔨 Création des index corrigés...');
    await TempChatArchive.syncIndexes();
    
    // 5. Vérification
    console.log('\n🔍 Vérification finale...');
    const indexes = await TempChatArchive.collection.getIndexes();
    
    console.log(`📊 Index créés: ${Object.keys(indexes).length}`);
    Object.entries(indexes).forEach(([name, spec]) => {
      const fields = Object.keys(spec.key).map(k => `${k}:${spec.key[k]}`).join(', ');
      const ttl = spec.expireAfterSeconds !== undefined ? ` (TTL: ${spec.expireAfterSeconds}s)` : '';
      console.log(`  • ${name}: {${fields}}${ttl}`);
    });
    
    console.log('\n🎉 NETTOYAGE FORCÉ TERMINÉ!');
    console.log('\n💡 IMPORTANT: Vous devez maintenant CORRIGER votre fichier ChatArchive.js:');
    console.log('   Supprimez la ligne: chatArchiveSchema.index({ expiresAt: 1 });');
    console.log('   Gardez uniquement: chatArchiveSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté');
  }
}

forceFixChatArchive();