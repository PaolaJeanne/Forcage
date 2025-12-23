// test-chat-ids.js - À exécuter: node test-chat-ids.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function testChatIds() {
  try {
    console.log('🔍 ========== TEST DES IDS POUR LE CHAT ==========\n');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'forcing_db'
    });
    
    console.log('✅ Connecté à MongoDB\n');
    
    // ========== 1. VÉRIFIER L'ID PROBLÉMATIQUE ==========
    const problematicId = '69494aee815b16aec2ffd01c';
    
    console.log(`1️⃣ VÉRIFICATION DE L'ID PROBLÉMATIQUE`);
    console.log(`   ID recherché: ${problematicId}\n`);
    
    const foundUser = await User.findById(problematicId);
    
    if (foundUser) {
      console.log('✅ Utilisateur TROUVÉ:');
      console.log(`   Nom: ${foundUser.prenom} ${foundUser.nom}`);
      console.log(`   Email: ${foundUser.email}`);
      console.log(`   Rôle: ${foundUser.role}`);
      console.log(`   Actif: ${foundUser.isActive}`);
      console.log(`   _id: ${foundUser._id}\n`);
      
      if (!foundUser.isActive) {
        console.log('⚠️  PROBLÈME: Cet utilisateur est INACTIF');
        console.log('   Action: Activer le compte avec:');
        console.log(`   db.users.updateOne({_id: ObjectId("${problematicId}")}, {$set: {isActive: true}})\n`);
      }
    } else {
      console.log('❌ Utilisateur NON TROUVÉ dans la base\n');
    }
    
    // ========== 2. LISTER TOUS LES MEMBRES D'ÉQUIPE ==========
    console.log(`2️⃣ MEMBRES D'ÉQUIPE DISPONIBLES\n`);
    
    const teamMembers = await User.find({
      role: { 
        $in: [
          'admin', 'conseiller', 'rm', 'dce', 'adg', 'dga',
          'risques', 'support', 'gestionnaire', 'commercial',
          'controleur', 'superviseur', 'operateur', 'auditeur'
        ] 
      },
      isActive: true
    })
    .select('_id email nom prenom role')
    .sort({ role: 1, nom: 1 })
    .lean();
    
    if (teamMembers.length === 0) {
      console.log('❌ AUCUN MEMBRE D\'ÉQUIPE TROUVÉ !');
      console.log('   Vous devez créer des utilisateurs avec les rôles appropriés.\n');
    } else {
      console.log(`✅ ${teamMembers.length} membre(s) trouvé(s):\n`);
      
      teamMembers.forEach((member, index) => {
        console.log(`${index + 1}. ${member.prenom} ${member.nom} (${member.role})`);
        console.log(`   ID: ${member._id}`);
        console.log(`   Email: ${member.email}\n`);
      });
    }
    
    // ========== 3. CLIENTS DANS LE SYSTÈME ==========
    console.log(`3️⃣ CLIENTS DISPONIBLES\n`);
    
    const clients = await User.find({ role: 'client', isActive: true })
      .select('_id email nom prenom')
      .lean();
    
    console.log(`✅ ${clients.length} client(s) actif(s):\n`);
    
    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.prenom} ${client.nom}`);
      console.log(`   ID: ${client._id}`);
      console.log(`   Email: ${client.email}\n`);
    });
    
    // ========== 4. EXEMPLE DE REQUÊTE VALIDE ==========
    console.log(`4️⃣ EXEMPLE DE REQUÊTE POST /api/v1/chat/direct\n`);
    
    if (clients.length > 0 && teamMembers.length > 0) {
      const exampleClient = clients[0];
      const exampleStaff = teamMembers[0];
      
      console.log('📤 Body JSON à envoyer:\n');
      console.log(JSON.stringify({
        recipientId: exampleStaff._id.toString(),
        message: "Bonjour, j'ai une question concernant ma demande de forçage.",
        subject: "Question sur demande"
      }, null, 2));
      
      console.log(`\n📝 Détails:`);
      console.log(`   Client: ${exampleClient.email} (ID: ${exampleClient._id})`);
      console.log(`   Staff: ${exampleStaff.email} (ID: ${exampleStaff._id})`);
      
      console.log(`\n🔧 Commande cURL complète:\n`);
      console.log(`curl -X POST http://localhost:3000/api/v1/chat/direct \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN" \\`);
      console.log(`  -d '${JSON.stringify({
        recipientId: exampleStaff._id.toString(),
        message: "Bonjour, j'ai une question."
      })}'`);
      
    } else {
      console.log('⚠️  Impossible de générer un exemple: pas assez d\'utilisateurs');
    }
    
    // ========== 5. VALIDATION FORMAT OBJECTID ==========
    console.log(`\n\n5️⃣ TESTS DE VALIDATION\n`);
    
    const testIds = [
      problematicId,
      '69495235c7c278458e4cf83c', // mike@gmail.com du log
      'invalid-id-format',
      '',
      '123'
    ];
    
    testIds.forEach(id => {
      const isValid = mongoose.Types.ObjectId.isValid(id);
      const symbol = isValid ? '✅' : '❌';
      console.log(`${symbol} "${id}" → ${isValid ? 'VALIDE' : 'INVALIDE'}`);
    });
    
    console.log('\n========== FIN DU TEST ==========\n');
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

testChatIds();