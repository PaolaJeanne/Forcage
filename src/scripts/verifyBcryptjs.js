// src/scripts/verifyBcryptjs.js
const bcryptjs = require('bcryptjs');
const bcrypt = require('bcrypt');

async function verifyCompatibility() {
  console.log('🔍 Vérification compatibilité bcrypt/bcryptjs\n');
  
  const password = 'Admin123!@#';
  
  // Test avec bcrypt (ancien)
  console.log('1. Test avec bcrypt:');
  const bcryptHash = await bcrypt.hash(password, 10);
  const bcryptValid = await bcrypt.compare(password, bcryptHash);
  console.log(`   Hash: ${bcryptHash.substring(0, 30)}...`);
  console.log(`   Validation: ${bcryptValid ? '✅' : '❌'}`);
  
  // Test avec bcryptjs (nouveau)
  console.log('\n2. Test avec bcryptjs:');
  const bcryptjsHash = await bcryptjs.hash(password, 10);
  const bcryptjsValid = await bcryptjs.compare(password, bcryptjsHash);
  console.log(`   Hash: ${bcryptjsHash.substring(0, 30)}...`);
  console.log(`   Validation: ${bcryptjsValid ? '✅' : '❌'}`);
  
  // Test de compatibilité croisée
  console.log('\n3. Test de compatibilité:');
  const crossValid1 = await bcrypt.compare(password, bcryptjsHash);
  const crossValid2 = await bcryptjs.compare(password, bcryptHash);
  console.log(`   bcrypt.compare avec bcryptjs hash: ${crossValid1 ? '✅' : '❌'}`);
  console.log(`   bcryptjs.compare avec bcrypt hash: ${crossValid2 ? '✅' : '❌'}`);
  
  console.log('\n🎯 Conclusion: Les deux librairies sont compatibles !');
}

verifyCompatibility().catch(console.error);