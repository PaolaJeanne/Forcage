// src/scripts/complet-user-data-enhanced.js
// ------------------------------------------------------------
// This script completes ALL missing data for users, including:
// - Numéro de compte bancaire
// - Informations CNI
// - Adresse
// - Date de naissance
// - Profession
// - Informations de contact d'urgence
// - etc.
// ------------------------------------------------------------

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Agency = require('../models/Agency');

// Load environment variables
require('dotenv').config();

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/force-management';

// Default agency information
const DEFAULT_AGENCY_NAME = "Agence Sud";
const DEFAULT_AGENCY_ID = "695981001c1539e06f49970f";

// Helper to generate realistic Cameroonian CNI numbers
const generateCNI = () => {
    const prefix = ['1234', '2345', '3456', '4567', '5678'][Math.floor(Math.random() * 5)];
    const middle = Math.floor(1000 + Math.random() * 9000);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${middle}${suffix}`;
};

// Helper to generate account numbers
const generateAccountNumber = (role, firstName, lastName) => {
    const prefixes = {
        'admin': 'ADMIN',
        'client': 'CLT',
        'conseiller': 'CONS',
        'rm': 'RM',
        'dce': 'DCE'
    };
    const prefix = prefixes[role] || 'USR';
    const initials = (firstName?.[0] || '') + (lastName?.[0] || '');
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${initials}${randomNum}`;
};

// Helper to generate IBAN (Cameroonian format)
const generateIBAN = () => {
    const countryCode = 'CM';
    const checkDigits = Math.floor(10 + Math.random() * 90);
    const bankCode = '1000' + Math.floor(1 + Math.random() * 9);
    const branchCode = '0' + Math.floor(1000 + Math.random() * 9000);
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000);
    return `${countryCode}${checkDigits}${bankCode}${branchCode}${accountNumber}`;
};

// Helper to generate random dates (age between 18 and 70)
const generateBirthDate = () => {
    const today = new Date();
    const maxAge = 70;
    const minAge = 18;
    const randomAge = Math.floor(minAge + Math.random() * (maxAge - minAge));
    const birthYear = today.getFullYear() - randomAge;
    const birthMonth = Math.floor(Math.random() * 12);
    const birthDay = Math.floor(1 + Math.random() * 28); // Avoid month-end issues
    return new Date(birthYear, birthMonth, birthDay);
};

// List of common professions in Cameroon
const professions = [
    "Commerçant",
    "Fonctionnaire",
    "Enseignant",
    "Infirmier",
    "Ingénieur",
    "Agriculteur",
    "Étudiant",
    "Artisan",
    "Chef d'entreprise",
    "Chauffeur",
    "Médecin",
    "Avocat",
    "Agent administratif",
    "Technicien",
    "Consultant"
];

// List of common addresses in Cameroon
const addresses = [
    { ville: "Douala", quartier: "Bonapriso", rue: "Rue des Écoles" },
    { ville: "Yaoundé", quartier: "Bastos", rue: "Avenue Kennedy" },
    { ville: "Douala", quartier: "Akwa", rue: "Boulevard de la Liberté" },
    { ville: "Yaoundé", quartier: "Mvog-Ada", rue: "Rue Ngousso" },
    { ville: "Bafoussam", quartier: "Commercial", rue: "Avenue des Banques" },
    { ville: "Garoua", quartier: "Porte Mayo", rue: "Boulevard du 20 Mai" },
    { ville: "Maroua", quartier: "Domayo", rue: "Rue du Marché" },
    { ville: "Bamenda", quartier: "Commercial Avenue", rue: "Station Road" }
];

(async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to MongoDB');

        // Try to fetch default agency
        let defaultAgency = await Agency.findOne({ name: /Sud/i }).exec();
        let defaultAgencyName = defaultAgency ? defaultAgency.name : DEFAULT_AGENCY_NAME;
        let defaultAgencyId = defaultAgency ? defaultAgency._id : DEFAULT_AGENCY_ID;

        console.log(`🏢 Using default agency: ${defaultAgencyName}`);

        // Find ALL users
        const users = await User.find({}).exec();
        console.log(`📋 Found ${users.length} user(s) to inspect\n`);

        const updates = [];
        let clientCount = 1;

        for (const user of users) {
            const updatesForUser = {};
            const userEmail = user.email || `${user.nom}.${user.prenom}@example.com`;
            const isClient = user.role === 'client';

            console.log(`🔍 Processing: ${user.nom} ${user.prenom} (${user.role})`);

            // ====== CHAMPS OBLIGATOIRES POUR TOUS LES UTILISATEURS ======
            
            // 1. NUMERO DE COMPTE BANCAIRE
            if (!user.numeroCompte) {
                const accountNumber = generateAccountNumber(user.role, user.prenom, user.nom);
                updatesForUser.numeroCompte = accountNumber;
                console.log(`   💳 Added account number: ${accountNumber}`);
            }

            // 2. AGENCE (si manquant)
            if (!user.agence) {
                updatesForUser.agence = defaultAgencyName;
                console.log(`   🏢 Added agency: ${defaultAgencyName}`);
            }

            // 3. AGENCY ID (si manquant)
            if (!user.agencyId) {
                updatesForUser.agencyId = defaultAgencyId;
            }

            // ====== CHAMPS SPÉCIFIQUES AUX CLIENTS ======
            if (isClient) {
                // 4. INFORMATIONS CNI
                if (!user.numeroCNI) {
                    updatesForUser.numeroCNI = generateCNI();
                    console.log(`   🆔 Added CNI: ${updatesForUser.numeroCNI}`);
                }

                if (!user.dateDelivranceCNI) {
                    const deliveranceDate = new Date();
                    deliveranceDate.setFullYear(deliveranceDate.getFullYear() - 3); // 3 years ago
                    updatesForUser.dateDelivranceCNI = deliveranceDate;
                }

                if (!user.dateExpirationCNI) {
                    const expirationDate = new Date();
                    expirationDate.setFullYear(expirationDate.getFullYear() + 7); // 7 years from now
                    updatesForUser.dateExpirationCNI = expirationDate;
                }

                if (!user.lieuDelivranceCNI) {
                    updatesForUser.lieuDelivranceCNI = "Commissariat Central";
                }

                // 5. ADRESSE COMPLÈTE
                if (!user.adresse) {
                    const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];
                    updatesForUser.adresse = {
                        rue: randomAddress.rue,
                        quartier: randomAddress.quartier,
                        ville: randomAddress.ville,
                        codePostal: `P${Math.floor(1000 + Math.random() * 9000)}`,
                        pays: "Cameroun"
                    };
                    console.log(`   🏠 Added address: ${randomAddress.ville}, ${randomAddress.quartier}`);
                }

                // 6. DATE DE NAISSANCE
                if (!user.dateNaissance) {
                    updatesForUser.dateNaissance = generateBirthDate();
                    const age = new Date().getFullYear() - updatesForUser.dateNaissance.getFullYear();
                    console.log(`   🎂 Added birth date (age: ${age})`);
                }

                // 7. LIEU DE NAISSANCE
                if (!user.lieuNaissance) {
                    const villesNaissance = ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Maroua", "Bamenda", "Ngaoundéré", "Bertoua"];
                    updatesForUser.lieuNaissance = villesNaissance[Math.floor(Math.random() * villesNaissance.length)];
                }

                // 8. NATIONALITÉ
                if (!user.nationalite) {
                    updatesForUser.nationalite = "Camerounaise";
                }

                // 9. SITUATION MATRIMONIALE
                if (!user.situationMatrimoniale) {
                    const situations = ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"];
                    updatesForUser.situationMatrimoniale = situations[Math.floor(Math.random() * situations.length)];
                }

                // 10. PROFESSION
                if (!user.profession) {
                    updatesForUser.profession = professions[Math.floor(Math.random() * professions.length)];
                    console.log(`   💼 Added profession: ${updatesForUser.profession}`);
                }

                // 11. EMPLOYEUR
                if (!user.employeur) {
                    const employeurs = ["Secteur Public", "Secteur Privé", "Indépendant", "À la recherche d'emploi", "Étudiant"];
                    updatesForUser.employeur = employeurs[Math.floor(Math.random() * employeurs.length)];
                }

                // 12. REVENU MENSUEL
                if (typeof user.revenuMensuel !== 'number') {
                    const revenus = [50000, 75000, 100000, 150000, 200000, 300000, 500000];
                    updatesForUser.revenuMensuel = revenus[Math.floor(Math.random() * revenus.length)];
                }

                // 13. CONTACT D'URGENCE
                if (!user.contactUrgence) {
                    const prefixes = ['+23765', '+23767', '+23769'];
                    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                    const suffix = Math.floor(1000000 + Math.random() * 9000000);
                    updatesForUser.contactUrgence = {
                        nom: "Contact Urgence",
                        telephone: prefix + suffix.toString().slice(1),
                        lien: "Parent"
                    };
                }

                // 14. IBAN (pour virements internationaux)
                if (!user.iban) {
                    updatesForUser.iban = generateIBAN();
                    console.log(`   🌍 Added IBAN: ${updatesForUser.iban}`);
                }

                // 15. TYPE DE COMPTE
                if (!user.typeCompte) {
                    const typesCompte = ["Compte Courant", "Compte Épargne", "Compte Jeune", "Compte Professionnel"];
                    updatesForUser.typeCompte = typesCompte[Math.floor(Math.random() * typesCompte.length)];
                }

                // 16. DATE OUVERTURE COMPTE
                if (!user.dateOuvertureCompte) {
                    updatesForUser.dateOuvertureCompte = user.createdAt || new Date();
                }

                // 17. SOURCE DE FONDS
                if (!user.sourceFonds) {
                    const sources = ["Salaire", "Commerce", "Agriculture", "Pension", "Transferts", "Épargne"];
                    updatesForUser.sourceFonds = sources[Math.floor(Math.random() * sources.length)];
                }

                // 18. OBJECTIF COMPTE
                if (!user.objectifCompte) {
                    const objectifs = ["Épargne", "Transactions courantes", "Entreprise", "Éducation", "Projet personnel"];
                    updatesForUser.objectifCompte = objectifs[Math.floor(Math.random() * objectifs.length)];
                }

                // 19. DOCUMENTS FOURNIS
                if (!user.documentsFournis) {
                    updatesForUser.documentsFournis = {
                        cni: true,
                        justificatifDomicile: true,
                        photo: true,
                        attestationTravail: Math.random() > 0.5
                    };
                }

                // 20. SCORE CREDIT (simulé)
                if (typeof user.scoreCredit !== 'number') {
                    updatesForUser.scoreCredit = Math.floor(300 + Math.random() * 500); // 300-800
                }

                clientCount++;
            }

            // ====== CHAMPS POUR TOUS LES RÔLES ======
            
            // 21. GENRE (si manquant)
            if (!user.genre) {
                // Déterminer le genre basé sur le prénom
                const prenom = user.prenom || '';
                const femaleNames = ['Jeanne', 'Marie', 'Anne', 'Claire', 'Sophie', 'Julie'];
                const maleNames = ['Albert', 'Jean', 'Pierre', 'Paul', 'Jacques', 'Marc'];
                
                if (femaleNames.some(name => prenom.includes(name))) {
                    updatesForUser.genre = 'Féminin';
                } else if (maleNames.some(name => prenom.includes(name))) {
                    updatesForUser.genre = 'Masculin';
                } else {
                    updatesForUser.genre = Math.random() > 0.5 ? 'Masculin' : 'Féminin';
                }
            }

            // 22. STATUT EMPLOI (pour tous)
            if (!user.statutEmploi && user.role === 'client') {
                const statuts = ["Employé", "Indépendant", "Chômeur", "Retraité", "Étudiant"];
                updatesForUser.statutEmploi = statuts[Math.floor(Math.random() * statuts.length)];
            }

            // 23. SECTEUR ACTIVITÉ
            if (!user.secteurActivite && user.role === 'client') {
                const secteurs = ["Commerce", "Services", "Industrie", "Agriculture", "Administration", "Santé", "Éducation"];
                updatesForUser.secteurActivite = secteurs[Math.floor(Math.random() * secteurs.length)];
            }

            // 24. HISTORIQUE TRANSACTIONS (vide par défaut)
            if (!user.historiqueTransactions) {
                updatesForUser.historiqueTransactions = [];
            }

            // 25. COMPTEURS DE TRANSACTIONS
            if (typeof user.nombreTransactions !== 'number') {
                updatesForUser.nombreTransactions = 0;
            }
            if (typeof user.montantTotalTransactions !== 'number') {
                updatesForUser.montantTotalTransactions = 0;
            }

            // 26. PRÉFÉRENCES DE COMMUNICATION
            if (!user.preferencesCommunication) {
                updatesForUser.preferencesCommunication = {
                    email: true,
                    sms: true,
                    notificationsApp: true,
                    newsletter: false
                };
            }

            // 27. MÉTADONNÉES DE SÉCURITÉ
            if (!user.metadataSecurite) {
                updatesForUser.metadataSecurite = {
                    dernierChangementMdp: user.lastLogin || new Date(),
                    tentativeConnexion: 0,
                    bloque: false,
                    mfaActive: false,
                    appareilsAutorises: []
                };
            }

            // 28. TAGS/CATÉGORIES
            if (!user.tags) {
                const tags = [];
                if (user.role === 'client') tags.push('client');
                if (user.kycValide) tags.push('kyc-valide');
                if (user.listeSMP) tags.push('smp');
                tags.push(user.classification || 'normal');
                updatesForUser.tags = tags;
            }

            // 29. NOTES INTERNES
            if (!user.notesInternes) {
                updatesForUser.notesInternes = `Client ${user.role} créé le ${new Date(user.createdAt).toLocaleDateString()}`;
            }

            // 30. DATE DE MAJ AUTOMATIQUE
            updatesForUser.updatedAt = new Date();

            // Apply updates if any field needs fixing
            if (Object.keys(updatesForUser).length > 0) {
                try {
                    await User.updateOne({ _id: user._id }, { $set: updatesForUser }).exec();
                    updates.push({ 
                        email: user.email, 
                        role: user.role,
                        updatedFields: Object.keys(updatesForUser),
                        updateCount: Object.keys(updatesForUser).length
                    });
                    console.log(`   ✅ Updated: ${Object.keys(updatesForUser).length} fields added\n`);
                } catch (error) {
                    console.error(`   ❌ Error updating ${user.email}:`, error.message);
                }
            } else {
                console.log(`   ➡️  No updates needed\n`);
            }
        }

        // ====== AFFICHER LE RAPPORT DÉTAILLÉ ======
        console.log('\n' + '='.repeat(60));
        console.log('📊 RAPPORT COMPLET DES MISES À JOUR');
        console.log('='.repeat(60));

        if (updates.length === 0) {
            console.log('✅ Tous les utilisateurs sont déjà complets. Aucune mise à jour nécessaire.');
        } else {
            const totalUpdates = updates.reduce((sum, u) => sum + u.updateCount, 0);
            console.log(`\n📈 STATISTIQUES GÉNÉRALES:`);
            console.log(`   • Utilisateurs traités: ${users.length}`);
            console.log(`   • Utilisateurs mis à jour: ${updates.length}`);
            console.log(`   • Total des champs ajoutés: ${totalUpdates}`);
            console.log(`   • Moyenne par utilisateur: ${(totalUpdates / updates.length).toFixed(1)} champs`);

            // Grouper par rôle
            const byRole = {};
            updates.forEach(u => {
                if (!byRole[u.role]) byRole[u.role] = { count: 0, fields: new Set() };
                byRole[u.role].count++;
                u.updatedFields.forEach(f => byRole[u.role].fields.add(f));
            });

            console.log('\n👥 RÉPARTITION PAR RÔLE:');
            Object.keys(byRole).forEach(role => {
                console.log(`   • ${role.toUpperCase()}: ${byRole[role].count} utilisateurs`);
            });

            // Champs les plus fréquents
            const fieldFrequency = {};
            updates.forEach(u => {
                u.updatedFields.forEach(field => {
                    fieldFrequency[field] = (fieldFrequency[field] || 0) + 1;
                });
            });

            console.log('\n🏆 TOP 10 DES CHAMPS AJOUTÉS:');
            Object.entries(fieldFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([field, count], index) => {
                    console.log(`   ${index + 1}. ${field}: ${count} fois`);
                });

            // Détail des clients (le plus important)
            const clientUpdates = updates.filter(u => u.role === 'client');
            if (clientUpdates.length > 0) {
                console.log('\n👤 DÉTAIL DES CLIENTS MIS À JOUR:');
                clientUpdates.forEach(client => {
                    console.log(`\n   📧 ${client.email}`);
                    console.log(`     Champs ajoutés (${client.updateCount}):`);
                    // Grouper par catégorie
                    const categories = {
                        'Identité': ['numeroCNI', 'dateNaissance', 'lieuNaissance', 'nationalite', 'genre'],
                        'Adresse': ['adresse'],
                        'Profession': ['profession', 'employeur', 'revenuMensuel', 'secteurActivite'],
                        'Compte': ['numeroCompte', 'iban', 'typeCompte', 'dateOuvertureCompte'],
                        'Autres': client.updatedFields.filter(f => 
                            !['numeroCNI', 'dateNaissance', 'lieuNaissance', 'nationalite', 'genre', 
                              'adresse', 'profession', 'employeur', 'revenuMensuel', 'secteurActivite',
                              'numeroCompte', 'iban', 'typeCompte', 'dateOuvertureCompte'].includes(f)
                        )
                    };

                    Object.entries(categories).forEach(([category, fields]) => {
                        const catFields = client.updatedFields.filter(f => fields.includes(f));
                        if (catFields.length > 0) {
                            console.log(`     • ${category}: ${catFields.join(', ')}`);
                        }
                    });
                });
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Script terminé avec succès!');
        console.log('='.repeat(60));

    } catch (err) {
        console.error('❌ Erreur pendant l\'exécution du script:', err);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Déconnecté de MongoDB');
        process.exit(0);
    }
})();