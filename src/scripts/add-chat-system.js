// scripts/add-chat-system.js
const mongoose = require('mongoose');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
require('dotenv').config();

async function migrateChatSystem() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Connecté à MongoDB');
    
    // Créer les indexes
    console.log('📊 Création des indexes...');
    
    await Conversation.createIndexes();
    await Message.createIndexes();
    
    console.log('✅ Indexes créés avec succès');
    
    // Créer des conversations pour les demandes existantes
    console.log('📊 Migration des demandes vers le système de chat...');
    
    const DemandeForçage = require('../src/models/DemandeForçage');
    const User = require('../src/models/User');
    
    const demandes = await DemandeForçage.find({
      statut: { $nin: ['brouillon', 'annulée'] }
    }).populate('clientId').populate('conseillerId');
    
    console.log(`📊 ${demandes.length} demandes à migrer`);
    
    let createdCount = 0;
    
    for (const demande of demandes) {
      try {
        // Vérifier que le client et le conseiller existent
        if (!demande.clientId || !demande.conseillerId) {
          continue;
        }
        
        // Créer les participants
        const participants = [demande.clientId._id, demande.conseillerId._id];
        
        // Ajouter les administrateurs
        const admins = await User.find({
          role: { $in: ['admin', 'dga', 'risques'] },
          _id: { $nin: participants }
        }).select('_id');
        
        participants.push(...admins.map(a => a._id));
        
        // Vérifier si une conversation existe déjà
        const existingConversation = await Conversation.findOne({
          participants: { $all: participants },
          demandeId: demande._id,
          type: 'support'
        });
        
        if (!existingConversation) {
          await Conversation.create({
            participants,
            type: 'support',
            demandeId: demande._id,
            title: `Discussion - Demande #${demande.numeroReference}`,
            unreadCount: new Map()
          });
          
          createdCount++;
          
          if (createdCount % 10 === 0) {
            console.log(`📊 ${createdCount} conversations créées...`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Erreur migration demande ${demande._id}:`, error.message);
      }
    }
    
    console.log(`✅ Migration terminée. ${createdCount} conversations créées`);
    
    mongoose.disconnect();
    console.log('👋 Déconnexion de MongoDB');
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
if (require.main === module) {
  migrateChatSystem();
}

module.exports = migrateChatSystem;