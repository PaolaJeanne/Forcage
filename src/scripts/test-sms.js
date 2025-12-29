//test-sms.js
const SMSService = require('./src/services/sms/sms.service');

async function test() {
  console.log('🧪 Test SMS Service...');
  
  try {
    // Test simple
    const result = await SMSService.sendSMS(
      '+2250700000000', // Numéro test
      'demande_soumise',
      {
        clientNom: 'Jean Dupont',
        demandeCode: 'FORC2024001',
        montant: '5.000.000',
        lienSuivi: 'https://app.forçage-bank.com/suivi'
      }
    );
    
    console.log('Result:', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

test();

