// verify-updates.js
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    
    const users = await User.find({});
    
    console.log('Vérification des mises à jour:');
    users.forEach(user => {
        console.log(`\n${user.nom} ${user.prenom} (${user.role})`);
        console.log(`Numéro de compte: ${user.numeroCompte || 'MANQUANT'}`);
        console.log(`Champs ajoutés récemment:`);
        
        const newFields = [
            'numeroCNI', 'adresse', 'dateNaissance', 'profession',
            'iban', 'genre', 'historiqueTransactions'
        ];
        
        newFields.forEach(field => {
            if (user[field]) {
                console.log(`  ✅ ${field}: ${JSON.stringify(user[field]).substring(0, 50)}...`);
            }
        });
    });
    
    await mongoose.disconnect();
})();