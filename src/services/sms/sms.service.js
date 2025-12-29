// src/services/sms/sms.service.js
const OrangeSMSService = require('./orange.service');
const TwilioSMSService = require('./twilio.service');
const SMSLog = require('../../models/SMSLog');
const NotificationTemplate = require('../../models/NotificationTemplate');

class SMSService {
  constructor() {
    this.providers = {
      orange: OrangeSMSService,
      twilio: TwilioSMSService
    };
    
    this.defaultProvider = process.env.SMS_DEFAULT_PROVIDER || 'orange';
    this.fallbackProvider = process.env.SMS_FALLBACK_PROVIDER || 'twilio';
  }

  async sendSMS(to, templateCode, variables = {}, options = {}) {
    try {
      // 1. Récupérer le template
      const template = await this.getTemplate(templateCode);
      if (!template) {
        throw new Error(`Template SMS "${templateCode}" non trouvé`);
      }

      // 2. Remplir le template avec les variables
      const message = this.renderTemplate(template.content, variables);
      
      // 3. Créer le log en base
      const smsLog = await SMSLog.create({
        to,
        message,
        templateCode,
        variables,
        provider: this.defaultProvider,
        status: 'pending',
        tags: options.tags || [],
        demandeId: options.demandeId,
        userId: options.userId
      });

      // 4. Envoyer via le provider principal
      let result = await this.sendWithProvider(
        this.defaultProvider, 
        to, 
        message, 
        options
      );

      // 5. Si échec, essayer le fallback
      if (!result.success && this.fallbackProvider) {
        console.log(`🔄 Tentative avec provider fallback: ${this.fallbackProvider}`);
        result = await this.sendWithProvider(
          this.fallbackProvider, 
          to, 
          message, 
          options
        );
        
        // Mettre à jour le log avec le nouveau provider
        smsLog.provider = this.fallbackProvider;
      }

      // 6. Mettre à jour le log
      smsLog.status = result.success ? 'sent' : 'failed';
      smsLog.providerMessageId = result.messageId;
      smsLog.cost = result.cost;
      smsLog.providerMetadata = result.providerResponse || {};
      smsLog.error = result.error;
      smsLog.sentAt = new Date();
      smsLog.attempts = smsLog.attempts + 1;
      
      await smsLog.save();

      // 7. Retourner le résultat
      return {
        success: result.success,
        messageId: smsLog._id,
        providerMessageId: result.messageId,
        provider: smsLog.provider,
        cost: result.cost,
        message: result.success ? 'SMS envoyé avec succès' : result.error
      };

    } catch (error) {
      console.error('❌ Erreur service SMS:', error);
      
      // Créer un log d'erreur
      await SMSLog.create({
        to,
        message: `Template: ${templateCode}`,
        templateCode,
        variables,
        provider: this.defaultProvider,
        status: 'failed',
        error: error.message,
        tags: options.tags || []
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendWithProvider(providerName, to, message, options) {
    try {
      const provider = this.providers[providerName];
      if (!provider) {
        throw new Error(`Provider "${providerName}" non supporté`);
      }

      return await provider.sendSMS(to, message, options);
      
    } catch (error) {
      console.error(`❌ Erreur provider ${providerName}:`, error);
      return {
        success: false,
        provider: providerName,
        error: error.message
      };
    }
  }

  async getTemplate(code) {
    // Chercher d'abord dans NotificationTemplate
    let template = await NotificationTemplate.findOne({
      code: code,
      canal: 'sms',
      actif: true
    });

    if (template) {
      return template;
    }

    // Templates SMS par défaut
    const defaultTemplates = {
      // Notifications workflow
      'demande_soumise': {
        content: 'Bonjour {{clientNom}}, votre demande #{{demandeCode}} a été soumise. Montant: {{montant}} FCFA. Suivi: {{lienSuivi}}'
      },
      'demande_validee': {
        content: 'Félicitations {{clientNom}}! Votre demande #{{demandeCode}} a été approuvée. Montant accordé: {{montantAccorde}} FCFA'
      },
      'demande_rejetee': {
        content: 'Bonjour {{clientNom}}, votre demande #{{demandeCode}} a été rejetée. Raison: {{raison}}. Contactez votre conseiller.'
      },
      'rappel_validation': {
        content: 'RAPPEL: Demande #{{demandeCode}} en attente de votre validation depuis {{jours}} jours. Lien: {{lienValidation}}'
      },
      'demande_en_retard': {
        content: 'ALERTE: Demande #{{demandeCode}} en retard de {{jours}} jours. Client: {{clientNom}}. Montant: {{montant}} FCFA'
      },
      
      // Notifications système
      'compte_creer': {
        content: 'Bonjour {{nom}}, votre compte Forçage Bancaire a été créé. Identifiant: {{email}}. Accédez à: {{lienApp}}'
      },
      'mot_de_passe_oublie': {
        content: 'Code de réinitialisation: {{code}}. Valide 15 minutes. Ne partagez pas ce code.'
      },
      'alerte_securite': {
        content: 'ALERTE: Connexion détectée depuis {{device}} à {{heure}}. Si ce n\'est pas vous, contactez le support.'
      }
    };

    if (defaultTemplates[code]) {
      return {
        content: defaultTemplates[code].content,
        variables: this.extractVariables(defaultTemplates[code].content)
      };
    }

    return null;
  }

  renderTemplate(template, variables) {
    let message = template;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, variables[key] || '');
    });
    
    // Nettoyer les variables non remplies
    message = message.replace(/{{[^}]+}}/g, '');
    
    return message.trim();
  }

  extractVariables(template) {
    const regex = /{{([^}]+)}}/g;
    const variables = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    
    return [...new Set(variables)]; // Retirer les doublons
  }

  async sendBulkSMS(recipients, templateCode, variablesArray, options = {}) {
    const results = [];
    
    for (let i = 0; i < recipients.length; i++) {
      const result = await this.sendSMS(
        recipients[i],
        templateCode,
        variablesArray[i] || {},
        options
      );
      
      results.push(result);
      
      // Limiter le taux d'envoi (1 SMS toutes les 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      total: recipients.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async getStatistics(period = '30days') {
    const dateFilter = this.getDateFilter(period);
    
    const stats = await SMSLog.aggregate([
      {
        $match: {
          createdAt: dateFilter
        }
      },
      {
        $group: {
          _id: {
            provider: '$provider',
            status: '$status'
          },
          count: { $sum: 1 },
          totalCost: { $sum: '$cost' }
        }
      },
      {
        $group: {
          _id: '$_id.provider',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' },
          totalCost: { $sum: '$totalCost' }
        }
      },
      {
        $project: {
          provider: '$_id',
          stats: 1,
          total: 1,
          totalCost: 1,
          successRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $sum: {
                      $cond: [{ $eq: ['$stats.status', 'sent'] }, '$stats.count', 0]
                    }
                  },
                  '$total'
                ]
              },
              100
            ]
          }
        }
      }
    ]);

    return stats;
  }

  getDateFilter(period) {
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    return { $gte: startDate };
  }

  async retryFailedSMS(limit = 50) {
    const failedSMS = await SMSLog.find({
      status: 'failed',
      attempts: { $lt: 3 }, // Max 3 tentatives
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24h max
    }).limit(limit);

    const results = [];
    
    for (const sms of failedSMS) {
      try {
        const result = await this.sendWithProvider(
          this.fallbackProvider || this.defaultProvider,
          sms.to,
          sms.message,
          {
            demandeId: sms.demandeId,
            userId: sms.userId
          }
        );

        sms.status = result.success ? 'sent' : 'failed';
        sms.provider = this.fallbackProvider || this.defaultProvider;
        sms.providerMessageId = result.messageId;
        sms.error = result.error;
        sms.attempts = sms.attempts + 1;
        sms.updatedAt = new Date();
        
        await sms.save();
        
        results.push({
          smsId: sms._id,
          to: sms.to,
          success: result.success,
          error: result.error
        });
        
      } catch (error) {
        results.push({
          smsId: sms._id,
          to: sms.to,
          success: false,
          error: error.message
        });
      }
      
      // Pause entre les retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
}

module.exports = new SMSService();