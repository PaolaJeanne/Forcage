// src/services/notificationTemplate.service.js
const NotificationTemplate = require('../models/NotificationTemplate');

class NotificationTemplateService {

  /**
   * Initialiser les templates par défaut
   */
  static async initialiserTemplatesParDefaut() {
    const templates = this.getTemplatesParDefaut();

    for (const template of templates) {
      try {
        const existe = await NotificationTemplate.findOne({ code: template.code });

        if (!existe) {
          await NotificationTemplate.create(template);

        }
      } catch (error) {

      }
    }


  }

  /**
   * Templates par défaut
   */
  static getTemplatesParDefaut() {
    return [
      {
        code: 'DEMANDE_CREEE',
        nom: 'Demande créée',
        description: 'Notifie le client qu\'une demande a été créée',
        type: 'success',
        categorie: 'demande',
        titreTemplate: '✅ Demande {{numeroReference}} créée',
        messageTemplate: 'Votre demande de {{typeOperation}} pour un montant de {{montant}} FCFA a été créée avec succès.',
        destinataireRoles: ['client'],
        priorite: 'normale',
        exempleVariables: {
          numeroReference: 'DF2025120001',
          typeOperation: 'VIREMENT',
          montant: '500000'
        }
      },
      {
        code: 'DEMANDE_SOUMISE',
        nom: 'Demande soumise',
        description: 'Notifie que la demande a été soumise',
        type: 'info',
        categorie: 'demande',
        titreTemplate: '📤 Demande {{numeroReference}} soumise',
        messageTemplate: 'Votre demande a été soumise et sera traitée dans les meilleurs délais.',
        destinataireRoles: ['client'],
        priorite: 'normale',
        exempleVariables: {
          numeroReference: 'DF2025120001'
        }
      },
      {
        code: 'DEMANDE_ASSIGNEE',
        nom: 'Demande assignée',
        description: 'Notifie le conseiller qu\'une demande lui a été assignée',
        type: 'info',
        categorie: 'demande',
        titreTemplate: '📋 Nouvelle demande assignée',
        messageTemplate: 'La demande {{numeroReference}} de {{clientNom}} vous a été assignée. Montant: {{montant}} FCFA',
        destinataireRoles: ['conseiller'],
        priorite: 'haute',
        exempleVariables: {
          numeroReference: 'DF2025120001',
          clientNom: 'Jean Dupont',
          montant: '500000'
        }
      },
      {
        code: 'DEMANDE_VALIDEE',
        nom: 'Demande validée',
        description: 'Notifie que la demande a été validée',
        type: 'success',
        categorie: 'demande',
        titreTemplate: '✅ Demande {{numeroReference}} validée',
        messageTemplate: 'Votre demande a été validée. Montant autorisé: {{montantAutorise}} FCFA. Échéance: {{dateEcheance}}',
        destinataireRoles: ['client'],
        priorite: 'urgente',
        exempleVariables: {
          numeroReference: 'DF2025120001',
          montantAutorise: '500000',
          dateEcheance: '31/12/2025'
        }
      },
      {
        code: 'DEMANDE_REFUSEE',
        nom: 'Demande refusée',
        description: 'Notifie que la demande a été refusée',
        type: 'error',
        categorie: 'demande',
        titreTemplate: '❌ Demande {{numeroReference}} refusée',
        messageTemplate: 'Votre demande a été refusée. Motif: {{motifRefus}}',
        destinataireRoles: ['client'],
        priorite: 'haute',
        exempleVariables: {
          numeroReference: 'DF2025120001',
          motifRefus: 'Documents incomplets'
        }
      },
      {
        code: 'DEMANDE_ECHEANCE_PROCHE',
        nom: 'Échéance proche',
        description: 'Rappel d\'échéance de régularisation',
        type: 'warning',
        categorie: 'demande',
        titreTemplate: '⚠️ Échéance proche - {{numeroReference}}',
        messageTemplate: 'La demande arrive à échéance le {{dateEcheance}}. Pensez à régulariser.',
        destinataireRoles: ['client', 'conseiller'],
        priorite: 'urgente',
        exempleVariables: {
          numeroReference: 'DF2025120001',
          dateEcheance: '31/12/2025'
        }
      }
    ];
  }

  /**
   * Lister tous les templates
   */
  static async listerTemplates(filters = {}) {
    const query = { actif: true };

    if (filters.categorie) query.categorie = filters.categorie;
    if (filters.type) query.type = filters.type;

    return await NotificationTemplate.find(query)
      .sort({ categorie: 1, code: 1 });
  }

  /**
   * Récupérer un template par code
   */
  static async getTemplateByCode(code) {
    return await NotificationTemplate.findOne({
      code: code.toUpperCase(),
      actif: true
    });
  }
}

module.exports = NotificationTemplateService;