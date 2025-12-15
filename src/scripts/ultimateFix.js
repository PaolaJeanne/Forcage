// src/scripts/ultimateFix.js
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
require('dotenv').config();

const ultimateFix = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('⚡ Solution ultime...\n');
    await client.connect();
    
    const db = client.db();
    const users = db.collection('users');
    
    // 1. Nettoyer complètement
    console.log('1. Nettoyage complet:');
    await users.deleteMany({});
    console.log('✅ Tous les utilisateurs supprimés\n');
    
    // 2. Créer admin avec PLAIN TEXT temporairement (pour debug)
    console.log('2. Création admin en texte clair (temporaire):');
    const adminDoc = {
      nom: 'Admin',
      prenom: 'System',
      email: 'admin@bank.cm',
      password: 'Admin123!@#', // TEXTE CLAIR - temporaire
      telephone: '+237600000000',
      numeroCompte: 'ADMIN001',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      note: 'MOT DE PASSE EN TEXTE CLAIR POUR DEBUG'
    };
    
    await users.insertOne(adminDoc);
    console.log('✅ Admin créé (texte clair)\n');
    
    // 3. Créer aussi un hash SHA-256 pour comparaison
    console.log('3. Création version SHA-256:');
    const sha256Hash = crypto.createHash('sha256')
      .update('Admin123!@#')
      .digest('hex');
    
    const adminSha256 = {
      nom: 'Admin',
      prenom: 'SHA256',
      email: 'admin256@bank.cm',
      password: sha256Hash,
      telephone: '+237600000001',
      numeroCompte: 'ADMIN256',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await users.insertOne(adminSha256);
    console.log(`✅ Admin SHA-256 créé: ${sha256Hash.substring(0, 30)}...\n`);
    
    // 4. Lister pour vérification
    console.log('4. Liste des admins créés:');
    const allAdmins = await users.find({ role: 'admin' }).toArray();
    
    allAdmins.forEach(admin => {
      console.log(`\n   📧 ${admin.email}`);
      console.log(`   🔑 Password: ${admin.password}`);
      console.log(`   📝 Note: ${admin.note || 'Hash SHA-256'}`);
    });
    
    console.log('\n🎉 DEUX ADMINS CRÉÉS !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   1. admin@bank.cm');
    console.log('      Password: Admin123!@# (TEXTE CLAIR - pour test)');
    console.log('');
    console.log('   2. admin256@bank.cm');
    console.log('      Password: Admin123!@# (Hash SHA-256)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🔧 Modifiez VOTRE authController pour tester:');
    console.log(`
    // TEMPORAIREMENT dans login function:
    exports.login = async (req, res) => {
      const { email, password } = req.body;
      
      // DEBUG: Afficher ce qui est reçu
      console.log('Login attempt:', { email, password: '***' });
      
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      
      // DEBUG: Afficher le mot de passe stocké
      console.log('Stored password:', user.password);
      
      // TEMPORAIRE: Accepter texte clair OU SHA-256
      let isValid = false;
      
      // 1. Si texte clair
      if (user.password === password) {
        isValid = true;
        console.log('✅ Validation texte clair');
      }
      // 2. Si SHA-256
      else {
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        if (sha256Hash === user.password) {
          isValid = true;
          console.log('✅ Validation SHA-256');
        }
      }
      
      if (isValid) {
        // Générer token...
        return res.json({ success: true, message: 'Connexion réussie' });
      } else {
        return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
      }
    };
    `);
    
    console.log('\n📝 Tests curl:');
    console.log(`
# Test admin texte clair
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@bank.cm","password":"Admin123!@#"}'

# Test admin SHA-256  
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin256@bank.cm","password":"Admin123!@#"}'
    `);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.close();
  }
};

ultimateFix();