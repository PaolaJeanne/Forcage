// generate-secrets.js
const crypto = require('crypto');

console.log('🔐 GÉNÉRATION DE SECRETS JWT SÉCURISÉS');
console.log('=======================================');

// Générer des secrets aléatoires de 64 caractères
const jwtSecret = crypto.randomBytes(64).toString('hex');
const refreshSecret = crypto.randomBytes(64).toString('hex');

console.log('\n✅ COPIEZ CES LIGNES DANS VOTRE FICHIER .env :\n');

console.log('# ===========================================');
console.log('# JWT SECRETS (GÉNÉRÉS LE ' + new Date().toISOString() + ')');
console.log('# ===========================================');
console.log('JWT_SECRET=' + jwtSecret);
console.log('JWT_REFRESH_SECRET=' + refreshSecret);
console.log('');
console.log('# Durées d\'expiration');
console.log('JWT_EXPIRES_IN=24h');
console.log('JWT_REFRESH_EXPIRES_IN=7d');
console.log('# ===========================================\n');

console.log('📋 VÉRIFICATION :');
console.log('• JWT_SECRET longueur:', jwtSecret.length, 'caractères');
console.log('• JWT_REFRESH_SECRET longueur:', refreshSecret.length, 'caractères');
console.log('• Les secrets sont différents?', jwtSecret !== refreshSecret ? '✅ OUI' : '❌ NON');