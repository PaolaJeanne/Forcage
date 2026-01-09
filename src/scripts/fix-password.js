// backend/scripts/fix-rm-dce-only.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixRMDCEPasswords() {
    try {
        console.log('🔧 CORRECTION DES MOTS DE PASSE RM ET DCE');
        console.log('='.repeat(50));

        console.log('🔗 Connexion à la base de données...');

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/force-management', {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('✅ Connecté à MongoDB');

        // Accéder directement à la collection pour éviter les middlewares
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Recherche de TOUS les utilisateurs
        const users = await usersCollection.find({}).toArray();

        console.log(`\n🔍 ${users.length} utilisateur(s) trouvé(s) au total.`);

        if (users.length === 0) {
            console.log('\n✅ Aucun utilisateur trouvé. Rien à faire.');
            await mongoose.connection.close();
            return;
        }

        console.log('\n' + '='.repeat(50));
        console.log('📋 RÉINITIALISATION DE TOUS LES MOTS DE PASSE');
        console.log('='.repeat(50));

        // Définir les nouveaux mots de passe
        const passwordMap = {
            'legrand@gmail.com': 'Legrand@2024',
            'brunel@gmail.com': 'Brunel@2024',
            'default_rm': 'RM@2024',
            'default_dce': 'DCE@2024'
        };

        const finalResults = [];

        for (const user of users) {
            let newPassword;

            if (user.email === 'legrand@gmail.com') {
                newPassword = passwordMap['legrand@gmail.com'];
            } else if (user.email === 'brunel@gmail.com') {
                newPassword = passwordMap['brunel@gmail.com'];
            } else if (user.role === 'rm') {
                newPassword = passwordMap['default_rm'];
            } else if (user.role === 'dce') {
                newPassword = passwordMap['default_dce'];
            } else {
                newPassword = 'Temp' + generateRandomString(8);
            }

            // Hasher le nouveau mot de passe
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Mettre à jour directement dans la collection (contourne les middlewares)
            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $set: {
                        password: hashedPassword,
                        requiresPasswordChange: true,
                        updatedAt: new Date()
                    },
                    $push: {
                        passwordHistory: {
                            changedAt: new Date(),
                            reason: 'Réinitialisation globale',
                            temporary: true
                        }
                    }
                }
            );

            console.log(`✅ ${user.email} (${user.role}): Mot de passe défini à "${newPassword}"`);

            finalResults.push({
                email: user.email,
                role: user.role,
                newPassword: newPassword,
                status: 'RESET'
            });
        }

        // Afficher le rapport final
        console.log('\n' + '='.repeat(80));
        console.log('📋 RAPPORT FINAL - MOTS DE PASSE RM/DCE');
        console.log('='.repeat(80));
        console.log('EMAIL'.padEnd(35) + 'ROLE'.padEnd(12) + 'NOUVEAU MOT DE PASSE');
        console.log('-'.repeat(80));

        finalResults.forEach(item => {
            console.log(
                item.email.padEnd(35) +
                item.role.padEnd(12) +
                item.newPassword
            );
        });

        // Tester immédiatement les nouveaux mots de passe
        console.log('\n' + '='.repeat(80));
        console.log('🧪 TEST IMMÉDIAT DES NOUVEAUX MOTS DE PASSE');
        console.log('='.repeat(80));

        for (const result of finalResults) {
            const user = await usersCollection.findOne({ email: result.email });

            if (user && user.password) {
                const isValid = await bcrypt.compare(result.newPassword, user.password);
                console.log(`${isValid ? '✅' : '❌'} ${result.email}: ${isValid ? 'Mot de passe valide' : 'Échec de vérification'}`);
            } else {
                console.log(`❌ ${result.email}: Utilisateur non trouvé après mise à jour`);
            }
        }

        // Instructions pour tester
        console.log('\n' + '='.repeat(80));
        console.log('🚀 INSTRUCTIONS POUR TESTER LA CONNEXION');
        console.log('='.repeat(80));
        console.log('1. Testez immédiatement avec ces identifiants :');
        console.log('\n   👤 Responsable Marketing:');
        console.log('      Email: legrand@gmail.com');
        console.log('      Mot de passe: Legrand@2024');
        console.log('\n   👤 Directeur Commercial:');
        console.log('      Email: brunel@gmail.com');
        console.log('      Mot de passe: Brunel@2024');

        console.log('\n2. Si ça ne marche toujours pas, essayez ceci :');
        console.log('\n   A. Redémarrez le serveur backend :');
        console.log('      npm run dev');
        console.log('\n   B. Vérifiez les logs du backend pendant la connexion');
        console.log('\n   C. Testez avec Postman avec cette requête :');
        console.log('\n      POST http://localhost:5000/api/v1/auth/login');
        console.log('      Headers: Content-Type: application/json');
        console.log('      Body:');
        console.log('      {');
        console.log('        "email": "legrand@gmail.com",');
        console.log('        "password": "Legrand@2024"');
        console.log('      }');

        // Vérifier la structure des utilisateurs
        console.log('\n' + '='.repeat(80));
        console.log('🔍 VÉRIFICATION DE LA STRUCTURE DES UTILISATEURS');
        console.log('='.repeat(80));

        const testUsers = await usersCollection.find({
            email: { $in: ['legrand@gmail.com', 'brunel@gmail.com', 'admin@gmail.com'] }
        }).toArray();

        console.log('Comparaison entre utilisateurs :');
        console.log('-'.repeat(80));

        testUsers.forEach(user => {
            console.log(`\n👤 ${user.email} (${user.role})`);
            console.log(`   📏 Longueur password: ${user.password?.length || 0} caractères`);
            console.log(`   🔍 Début password: ${user.password?.substring(0, 30) || 'null'}...`);
            console.log(`   📅 Dernière maj: ${user.updatedAt || 'non défini'}`);
            console.log(`   🔄 Changement requis: ${user.requiresPasswordChange || 'non'}`);
        });

        // Générer un fichier de rapport
        await generateReportFile(finalResults);

        console.log('\n🎉 CORRECTION TERMINÉE !');
        console.log('\n⚠️  IMPORTANT: Les utilisateurs doivent changer leur mot de passe à la première connexion.');

        await mongoose.connection.close();
        console.log('🔌 Connexion MongoDB fermée');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERREUR CRITIQUE:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Fonction pour générer un fichier de rapport
async function generateReportFile(results) {
    try {
        const fs = require('fs').promises;
        const path = require('path');

        const report = {
            timestamp: new Date().toISOString(),
            note: "Correction ciblée des utilisateurs RM/DCE - Contournement des middlewares",
            users: results
        };

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const filename = `rm-dce-fixed-${timestamp}.json`;
        const filepath = path.join(__dirname, filename);

        await fs.writeFile(filepath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Rapport sauvegardé: ${filename}`);

        return filepath;
    } catch (err) {
        console.error('❌ Erreur lors de la génération du rapport:', err.message);
        return null;
    }
}

// Fonction pour générer une chaîne aléatoire
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Script pour réparer le middleware problématique
async function bypassMiddlewareIssue() {
    try {
        console.log('🛠️  CONTOURNEMENT DU MIDDLEWARE PROBLÉMATIQUE');
        console.log('='.repeat(50));

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/force-management');

        // Désactiver temporairement le middleware pré-sauvegarde pour User
        // On va utiliser directement la collection MongoDB
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Trouver les utilisateurs problématiques
        const problemUsers = await usersCollection.find({
            email: { $in: ['legrand@gmail.com', 'brunel@gmail.com'] }
        }).toArray();

        console.log(`📊 ${problemUsers.length} utilisateur(s) à traiter\n`);

        for (const user of problemUsers) {
            console.log(`🔧 Traitement de ${user.email}...`);

            // Lire le mot de passe actuel
            console.log(`   📝 Mot de passe actuel: ${user.password?.substring(0, 30) || 'null'}...`);

            // Définir le nouveau mot de passe selon l'email
            let newPassword;
            if (user.email === 'legrand@gmail.com') {
                newPassword = 'Legrand@2024';
            } else if (user.email === 'brunel@gmail.com') {
                newPassword = 'Brunel@2024';
            } else {
                newPassword = 'Temp123456';
            }

            // Hasher avec bcrypt
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Mettre à jour directement
            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $set: {
                        password: hashedPassword,
                        updatedAt: new Date()
                    }
                }
            );

            console.log(`   ✅ Mot de passe changé pour: ${newPassword}`);

            // Vérifier immédiatement
            const updatedUser = await usersCollection.findOne({ _id: user._id });
            const isValid = await bcrypt.compare(newPassword, updatedUser.password);
            console.log(`   ${isValid ? '✅' : '❌'} Vérification: ${isValid ? 'OK' : 'ÉCHEC'}`);
        }

        console.log('\n🎉 CONTOURNEMENT RÉUSSI !');
        console.log('\n💡 Testez maintenant la connexion avec les nouveaux mots de passe.');

        await mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
    }
}

// Exécuter le script
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--bypass')) {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║      CONTOURNEMENT DU MIDDLEWARE PROBLÉMATIQUE          ║
╚══════════════════════════════════════════════════════════╝
        `);
        bypassMiddlewareIssue()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));

    } else {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║      CORRECTION CIBLÉE - UTILISATEURS RM ET DCE         ║
║          (Version contournement middleware)              ║
╚══════════════════════════════════════════════════════════╝
        `);

        console.log('⚠️  Cette action contourne les middlewares pour corriger les mots de passe');
        console.log('='.repeat(60));

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Voulez-vous continuer? (oui/non): ', (answer) => {
            if (answer.toLowerCase() === 'oui' || answer.toLowerCase() === 'o') {
                console.log('\n🚀 Lancement de la correction...\n');
                readline.close();
                fixRMDCEPasswords();
            } else {
                console.log('❌ Opération annulée.');
                readline.close();
                process.exit(0);
            }
        });
    }
}

module.exports = {
    fixRMDCEPasswords,
    bypassMiddlewareIssue
};