// scripts/init-scheduler.js
require('dotenv').config();
const mongoose = require('mongoose');
const SchedulerService = require('../services/SchedulerService');   

async function initScheduler() {
  try {
    console.log('🔧 Initialisation du scheduler...');
    
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté');
    
    // Initialiser le scheduler
    await SchedulerService.initialize();
    
    console.log('✅ Scheduler initialisé avec succès');
    console.log('\n📅 Jobs configurés:');
    
    const status = SchedulerService.getJobStatus();
    console.log(JSON.stringify(status, null, 2));
    
    // Garder le script en vie pour tester
    console.log('\n⏳ Scheduler en cours d\'exécution...');
    console.log('Appuyez sur Ctrl+C pour arrêter\n');
    
    // Handler pour arrêt propre
    process.on('SIGINT', async () => {
      console.log('\n🛑 Arrêt du scheduler...');
      SchedulerService.stop();
      await mongoose.disconnect();
      console.log('✅ Arrêt complet');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erreur initialisation:', error);
    process.exit(1);
  }
}

initScheduler();