// src/scripts/resetAllPasswords.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const resetAllPasswords = async () => {
  try {
    console.log('🔄 Réinitialisation de tous les mots de passe avec bcrypt...\n');
    
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Récupérer tous les utilisateurs
    const users = await usersCollection.find({}).toArray();
    
    console.log(`📊 ${users.length} utilisateur(s) trouvé(s)\n`);
    
    let updatedCount = 0;
    let errors = [];
    
    for (const user of users) {
      try {
        console.log(`\n👤 Traitement: ${user.email}`);
        
        // Déterminer le password à utiliser
        let newPassword = 'Admin123!@#'; // Default pour admin
        
        if (user.role !== 'admin') {
          // Pour les autres utilisateurs, utiliser leur email comme base
          newPassword = `${user.email.split('@')[0]}123!`;
        }
        
        // Hacher avec bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Mettre à jour l'utilisateur
        await usersCollection.updateOne(
          { _id: user._id },
          { 
            $set: { 
              password: hashedPassword,
              updatedAt: new Date()
            } 
          }
        );
        
        console.log(`   ✅ Password mis à jour: ${newPassword}`);
        updatedCount++;
        
      } catch (userError) {
        console.log(`   ❌ Erreur pour ${user.email}:`, userError.message);
        errors.push({ email: user.email, error: userError.message });
      }
    }
    
    console.log('\n📊 RÉCAPITULATIF:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ✅ Mis à jour: ${updatedCount} utilisateur(s)`);
    console.log(`   ❌ Erreurs: ${errors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (errors.length > 0) {
      console.log('📋 Erreurs détaillées:');
      errors.forEach(err => {
        console.log(`   - ${err.email}: ${err.error}`);
      });
      console.log('');
    }
    
    // Vérifier que bcrypt fonctionne
    console.log('🧪 Test de vérification bcrypt:');
    const testUser = await usersCollection.findOne({ email: 'admin@bank.cm' });
    
    if (testUser && testUser.password) {
      const isValid = await bcrypt.compare('Admin123!@#', testUser.password);
      console.log(`   admin@bank.cm vérifié: ${isValid ? '✅' : '❌'}`);
      
      if (isValid) {
        console.log('\n🎉 TOUT EST PRÊT !');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   📧 admin@bank.cm`);
        console.log(`   🔑 Admin123!@#`);
        console.log(`   🔐 bcrypt: ✅ Fonctionnel`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

resetAllPasswords();