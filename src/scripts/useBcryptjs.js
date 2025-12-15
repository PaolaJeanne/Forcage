// src/scripts/useBcryptjs.js
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs'); // Alternative à bcrypt
require('dotenv').config();

const useBcryptjs = async () => {
  try {
    console.log('🔄 Utilisation de bcryptjs...\n');
    
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    
    // 1. Supprimer l'ancien admin
    await mongoose.connection.db.collection('users')
      .deleteOne({ email: 'admin@bank.cm' });
    
    console.log('🗑️  Ancien admin supprimé\n');
    
    // 2. Créer avec bcryptjs
    const password = 'Admin123!@#';
    console.log(`🔐 Hachage avec bcryptjs: "${password}"`);
    
    const salt = bcryptjs.genSaltSync(10);
    const hash = bcryptjs.hashSync(password, salt);
    
    console.log(`   Salt: ${salt.substring(0, 30)}...`);
    console.log(`   Hash: ${hash.substring(0, 60)}...`);
    console.log(`   Longueur: ${hash.length}\n`);
    
    // 3. Insérer
    const adminDoc = {
      nom: 'Admin',
      prenom: 'System',
      email: 'admin@bank.cm',
      password: hash,
      telephone: '+237600000000',
      numeroCompte: 'ADMIN001',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await mongoose.connection.db.collection('users').insertOne(adminDoc);
    console.log('✅ Admin créé avec bcryptjs\n');
    
    // 4. Vérifier avec bcryptjs
    const inserted = await mongoose.connection.db.collection('users')
      .findOne({ email: 'admin@bank.cm' });
    
    const isValid = bcryptjs.compareSync(password, inserted.password);
    console.log('🧪 Vérification avec bcryptjs:');
    console.log(`   bcryptjs.compareSync: ${isValid ? '✅' : '❌'}`);
    
    // 5. Vérifier avec bcrypt original aussi
    console.log('\n🧪 Vérification avec bcrypt original:');
    try {
      const bcrypt = require('bcrypt');
      const bcryptIsValid = await bcrypt.compare(password, inserted.password);
      console.log(`   bcrypt.compare: ${bcryptIsValid ? '✅' : '❌'}`);
    } catch (bcryptError) {
      console.log(`   bcrypt.compare: ❌ (${bcryptError.message})`);
    }
    
    if (isValid) {
      console.log('\n🎉 SUCCÈS avec bcryptjs !');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   Modifiez votre modèle User pour utiliser bcryptjs:');
      console.log('');
      console.log('   // Remplacer dans User.js:');
      console.log('   const bcrypt = require(\'bcrypt\');');
      console.log('   // Par:');
      console.log('   const bcrypt = require(\'bcryptjs\');');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('📝 Test avec curl:');
      console.log(`
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@bank.cm","password":"Admin123!@#"}'
      `);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

useBcryptjs();