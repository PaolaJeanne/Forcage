// src/scripts/test-audit.js - CORRIGÉ
require('dotenv').config();
const mongoose = require('mongoose');

// CORRECTION: Chemin relatif correct depuis src/scripts/
const { generateToken, getUserFromToken } = require('../utils/jwt.util');

async function testAuditUser() {
  try {
    console.log('🧪 Test audit utilisateur...\n');
    
    // Connexion MongoDB
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI non défini dans .env');
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connecté à MongoDB');
    
    // 1. Créer un utilisateur de test
    const User = require('../models/User');  // Notez le chemin
    
    // Nettoyer d'abord
    await User.deleteOne({ email: 'test-jwt@example.com' });
    
    const testUser = await User.create({
      email: 'test-jwt@example.com',
      password: 'Test123!',
      nom: 'Test',
      prenom: 'JWT',
      role: 'client',
      isActive: true
    });
    
    console.log('👤 Utilisateur créé - ID:', testUser._id.toString());
    
    // 2. Générer un token
    const token = generateToken({
      userId: testUser._id,
      email: testUser.email,
      role: testUser.role,
      nom: testUser.nom,
      prenom: testUser.prenom,
      limiteAutorisation: 0,
      agence: null,
      isActive: true
    });
    
    console.log('\n🔑 Token généré (début):', token.substring(0, 50) + '...');
    
    // 3. Vérifier le token
    const decodedUser = getUserFromToken(token);
    
    console.log('\n📊 User depuis token:');
    console.log('  - id:', decodedUser?.id);
    console.log('  - _id:', decodedUser?._id);
    console.log('  - email:', decodedUser?.email);
    
    if (decodedUser?.id) {
      const match = decodedUser.id.toString() === testUser._id.toString();
      console.log('\n✅ IDs correspondent?', match ? 'OUI 🎉' : 'NON ❌');
    }
    
    // Nettoyage
    await User.deleteOne({ email: 'test-jwt@example.com' });
    await mongoose.disconnect();
    
    console.log('\n✅ Test terminé avec succès!');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

testAuditUser();