// src/scripts/testBcrypt.js
const bcrypt = require('bcrypt');

const testBcrypt = async () => {
  console.log('🧪 Test complet de bcrypt...\n');
  
  try {
    // 1. Test basique
    console.log('1. Test basique:');
    const testPassword = 'Test123!@#';
    const hash = await bcrypt.hash(testPassword, 10);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Hash: ${hash.substring(0, 30)}...`);
    console.log(`   Longueur: ${hash.length}`);
    
    const isValid = await bcrypt.compare(testPassword, hash);
    console.log(`   Validation: ${isValid ? '✅' : '❌'}\n`);
    
    // 2. Test avec Admin123!@#
    console.log('2. Test avec Admin123!@#:');
    const adminPassword = 'Admin123!@#';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Hash: ${adminHash.substring(0, 30)}...`);
    
    const adminIsValid = await bcrypt.compare(adminPassword, adminHash);
    console.log(`   Validation: ${adminIsValid ? '✅' : '❌'}\n`);
    
    // 3. Test de comparaison avec mauvais password
    console.log('3. Test avec mauvais password:');
    const wrongPassword = 'Wrong123!@#';
    const wrongIsValid = await bcrypt.compare(wrongPassword, adminHash);
    console.log(`   Wrong password "${wrongPassword}": ${wrongIsValid ? '✅' : '❌'} (devrait être ❌)\n`);
    
    // 4. Vérifier la version
    console.log('4. Informations bcrypt:');
    console.log(`   Version: ${require('bcrypt/package.json').version}`);
    console.log(`   Module chargé depuis: ${require.resolve('bcrypt')}`);
    
    // 5. Test de performance
    console.log('\n5. Test de performance:');
    const start = Date.now();
    const perfHash = await bcrypt.hash('PerfTest123', 10);
    const end = Date.now();
    console.log(`   Temps de hash: ${end - start}ms`);
    
    console.log('\n🎉 TESTS BCrypt TERMINÉS !');
    
  } catch (error) {
    console.error('❌ Erreur bcrypt:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('NODE_MODULE_VERSION')) {
      console.error('\n🔧 Problème de version Node.js:');
      console.error('   Essayez: npm rebuild bcrypt --build-from-source');
      console.error('   OU: npm uninstall bcrypt && npm install bcryptjs');
    }
  }
};

testBcrypt();