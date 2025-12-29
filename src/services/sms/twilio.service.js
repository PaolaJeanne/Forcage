// src/services/sms/twilio.service.js
const twilio = require('twilio');

class TwilioSMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    this.client = twilio(this.accountSid, this.authToken);
  }

  async sendSMS(phoneNumber, message, options = {}) {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const response = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: formattedNumber,
        ...options
      });

      const result = {
        success: true,
        provider: 'twilio',
        messageId: response.sid,
        status: response.status,
        cost: response.price,
        providerResponse: response
      };

      console.log(`📱 SMS Twilio envoyé à ${formattedNumber}: ${response.sid}`);
      return result;

    } catch (error) {
      console.error('❌ Erreur envoi SMS Twilio:', error);
      
      return {
        success: false,
        provider: 'twilio',
        error: error.message,
        code: error.code
      };
    }
  }

  formatPhoneNumber(phone) {
    // Format international: +225XXXXXXXX
    let cleaned = phone.replace(/\s/g, '');
    
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.substring(2);
    } else if (cleaned.startsWith('0')) {
      cleaned = '+225' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+225' + cleaned;
    }
    
    return cleaned;
  }

  async getBalance() {
    try {
      const balance = await this.client.balance.fetch();
      
      return {
        success: true,
        balance: balance.balance,
        currency: balance.currency
      };
    } catch (error) {
      console.error('❌ Erreur récupération solde Twilio:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TwilioSMSService();