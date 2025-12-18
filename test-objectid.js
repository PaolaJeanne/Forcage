// test-objectid.js
const mongoose = require('mongoose');

console.log('🧪 Test ObjectId...');

const id = '693ff95186fc42fe8b4412a5';
const isValid = mongoose.Types.ObjectId.isValid(id);

console.log(`ID: ${id}`);
console.log(`Longueur: ${id.length}`);
console.log(`Est ObjectId valide? ${isValid}`);

// Vérifiez la structure
if (id.length !== 24) {
  console.log(`❌ Mauvaise longueur! ObjectId doit avoir 24 caractères, a ${id.length}`);
}

// Vérifiez les caractères hexadécimaux
const hexRegex = /^[0-9a-fA-F]{24}$/;
console.log(`Format hexadécimal? ${hexRegex.test(id)}`);