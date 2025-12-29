// src/services/sms/orange.service.js
const axios = require('axios');
const crypto = require('crypto');

class OrangeSMSService {
  constructor() {
    this.clientId = process.env.ORANGE_CLIENT_ID;
    this.clientSecret = process.env.ORANGE_CLIENT_SECRET;
    this.token = null;
    this.tokenExpiry = null;
    this.baseURL = 'https://api.orange.com';
    
    this.senderAddress = process.env.ORANGE_SENDER_ADDRESS || '2250000'; // Numéro court Orange
    this.senderName = process.env.SMS_SENDER_NAME || 'ForçageBank';
  }

  async authenticate() {
    try {
      // Encoder les credentials en base64
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        `${this.baseURL}/oauth/v3/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );
      
      this.token = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      console.log('✅ Authentification Orange SMS réussie');
      return this.token;
      
    } catch (error) {
      console.error('❌ Erreur authentification Orange:', error.response?.data || error.message);
      throw new Error(`Échec authentification Orange: ${error.message}`);
    }
  }

  async ensureToken() {
    if (!this.token || Date.now() >= this.tokenExpiry - 60000) { // 1 minute avant expiration
      await this.authenticate();
    }
    return this.token;
  }

  async sendSMS(phoneNumber, message, options = {}) {
    try {
      const token = await this.ensureToken();
      
      // Formater le numéro (Côte d'Ivoire: +225XXXXXXXX)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const payload = {
        outboundSMSMessageRequest: {
          address: `tel:${formattedNumber}`,
          senderAddress: `tel:${this.senderAddress}`,
          senderName: this.senderName,
          outboundSMSTextMessage: {
            message: message
          }
        }
      };

      const response = await axios.post(
        `${this.baseURL}/smsmessaging/v1/outbound/${this.senderAddress}/requests`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = {
        success: true,
        provider: 'orange',
        messageId: response.data.outboundSMSMessageRequest.resourceURL.split('/').pop(),
        status: 'sent',
        cost: 0, // Orange fournit des infos de coût dans la réponse
        providerResponse: response.data
      };

      console.log(`📱 SMS Orange envoyé à ${formattedNumber}: ${result.messageId}`);
      return result;

    } catch (error) {
      console.error('❌ Erreur envoi SMS Orange:', {
        phoneNumber,
        error: error.response?.data || error.message
      });
      
      return {
        success: false,
        provider: 'orange',
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status
      };
    }
  }

  async getBalance() {
    try {
      const token = await this.ensureToken();
      
      const response = await axios.get(
        `${this.baseURL}/sms/admin/v1/contracts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        balance: response.data.balance,
        currency: response.data.currency,
        contracts: response.data.contracts
      };
    } catch (error) {
      console.error('❌ Erreur récupération solde Orange:', error);
      return { success: false, error: error.message };
    }
  }

  async getSMSStatus(messageId) {
    try {
      const token = await this.ensureToken();
      
      const response = await axios.get(
        `${this.baseURL}/smsmessaging/v1/outbound/${this.senderAddress}/requests/${messageId}/deliveryInfos`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        status: response.data.deliveryInfo[0]?.deliveryStatus || 'unknown',
        delivered: response.data.deliveryInfo[0]?.deliveryStatus === 'DeliveredToNetwork',
        timestamp: response.data.deliveryInfo[0]?.timeStamp
      };
    } catch (error) {
      console.error('❌ Erreur statut SMS Orange:', error);
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(phone) {
    // Format: +225XXXXXXXX
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

  async sendBulkSMS(recipients, message, options = {}) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS(recipient, message, options);
        results.push({
          recipient,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
        
        // Respecter les limites de taux (1 SMS par seconde recommandé)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.push({
          recipient,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new OrangeSMSService();