// src/scripts/createCleanAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const createCleanAdmin = async () => {
  try {
    console.log('👑 Création d\'un admin propre avec bcrypt...\n');
    
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // 1. Supprimer tous les anciens admins
    await usersCollection.deleteMany({ 
      $or: [
        { email: 'admin@gmail.com' },
        { role: 'admin' }
      ]
    });
    console.log('🗑️  Anciens admins supprimés\n');
    
    // 2. Hacher le password avec bcrypt
    const password = 'Admin123!@#';
    console.log(`🔐 Hachage de: "${password}"`);
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log(`   Salt généré: ${salt.substring(0, 30)}...`);
    console.log(`   Hash bcrypt: ${hashedPassword.substring(0, 30)}...`);
    console.log(`   Longueur: ${hashedPassword.length} caractères\n`);
    
    // 3. Créer le nouvel admin
    const adminDoc = {
      nom: 'Admin',
      prenom: 'System',
      email: 'admin@gmail.com',
      password: hashedPassword,
      telephone: '+237600000000',
      numeroCompte: 'ADMIN001',
      role: 'admin',
      limiteAutorisation: 999999999,
      agence: 'Siège',
      classification: 'normal',
      soldeActuel: 0,
      decouvertAutorise: 0,
      notationClient: 'A',
      kycValide: true,
      dateKyc: new Date(),
      listeSMP: false,
      isActive: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await usersCollection.insertOne(adminDoc);
    console.log('✅ Admin créé en base\n');
    
    // 4. Vérifier IMMÉDIATEMENT avec bcrypt
    console.log('🧪 Vérification immédiate:');
    const insertedAdmin = await usersCollection.findOne({ email: 'admin@gmail.com' });
    
    if (!insertedAdmin) {
      console.log('❌ Admin non trouvé après insertion');
      return;
    }
    
    const isValid = await bcrypt.compare(password, insertedAdmin.password);
    console.log(`   bcrypt.compare: ${isValid ? '✅' : '❌'}`);
    
    // 5. Vérifier aussi avec la méthode du modèle
    console.log('\n🧪 Test avec modèle Mongoose:');
    const User = require('../models/User');
    const mongooseAdmin = await User.findOne({ email: 'admin@gmail.com' }).select('+password');
    
    if (mongooseAdmin) {
      const modelIsValid = await mongooseAdmin.comparePassword(password);
      console.log(`   user.comparePassword(): ${modelIsValid ? '✅' : '❌'}`);
    }
    
    if (isValid) {
      console.log('\n🎉 ADMIN BCrypt PRÊT !');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   Email:    admin@gmail.com');
      console.log('   Password: Admin123!@#');
      console.log('   Bcrypt:   ✅ 100% fonctionnel');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('📝 Commande de test:');
      console.log(`
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@gmail.com","password":"Admin123!@#"}'
      `);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
};

createCleanAdmin();