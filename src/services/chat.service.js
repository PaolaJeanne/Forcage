// src/services/chat.service.js - VERSION FINALE CORRIGÉE
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const DemandeForçage = require('../models/DemandeForçage');
const mongoose = require('mongoose');

class ChatService {

  // ==================== CONVERSATIONS ====================

  /**
   * Démarrer une conversation de groupe avec plusieurs membres
   */
  async startGroupConversation(userId, recipientIds, firstMessage, subject = null) {
    try {
      // Validation des IDs
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('ID utilisateur émetteur invalide');
      }

      recipientIds.forEach(id => {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new Error(`ID destinataire invalide: ${id}`);
        }
      });

      // Vérifier qu'on n'essaie pas de s'ajouter soi-même
      const filteredRecipients = recipientIds.filter(
        id => id.toString() !== userId.toString()
      );

      if (filteredRecipients.length === 0) {
        throw new Error('Vous devez sélectionner au moins un autre participant');
      }

      // Récupérer l'utilisateur émetteur
      const user = await User.findById(userId).select('email nom prenom role isActive');
      if (!user) {
        throw new Error('Votre compte utilisateur est introuvable');
      }

      if (!user.isActive) {
        throw new Error('Votre compte est inactif');
      }

      // Vérifier que tous les destinataires existent et sont actifs
      const recipients = await User.find({
        _id: { $in: filteredRecipients },
        isActive: true
      }).select('_id email nom prenom role');

      if (recipients.length !== filteredRecipients.length) {
        throw new Error('Un ou plusieurs destinataires sont introuvables ou inactifs');
      }

      // Créer la conversation de groupe
      const participants = [userId, ...filteredRecipients];
      const title = subject || `Groupe: ${user.prenom} ${user.nom} + ${recipients.length} autre(s)`;

      const conversation = await Conversation.create({
        participants,
        type: 'group',
        title,
        createdBy: userId,
        metadata: {
          priority: 'medium',
          createdAt: new Date()
        },
        lastActivityAt: new Date()
      });

      // Envoyer le premier message
      if (firstMessage && firstMessage.trim()) {
        await this.sendSimpleMessage(
          conversation._id,
          userId,
          firstMessage
        );
      }

      return conversation;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Démarrer une conversation avec un membre précis de l'équipe
   * Le client peut choisir avec qui il veut parler
   */
  async startDirectConversation(userId, recipientId, firstMessage, subject = null) {


    try {
      // ========== VALIDATION DES IDS ==========

      // Vérifier que les IDs sont valides (format MongoDB ObjectId)
      if (!mongoose.Types.ObjectId.isValid(userId)) {

        throw new Error('ID utilisateur émetteur invalide');
      }

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {

        throw new Error('ID utilisateur destinataire invalide');
      }

      // Vérifier qu'on n'essaie pas de s'envoyer un message à soi-même
      if (userId.toString() === recipientId.toString()) {

        throw new Error('Vous ne pouvez pas vous envoyer un message à vous-même');
      }



      // ========== RECHERCHE UTILISATEURS ==========

      const user = await User.findById(userId).select('email nom prenom role isActive');
      const recipient = await User.findById(recipientId).select('email nom prenom role isActive');



      // ========== GESTION ERREURS DÉTAILLÉES ==========

      if (!user) {


        // Lister quelques utilisateurs pour debug
        const sampleUsers = await User.find({}).select('_id email nom prenom').limit(5).lean();

        sampleUsers.forEach(u => {

        });

        throw new Error('Votre compte utilisateur est introuvable. Veuillez vous reconnecter.');
      }

      if (!recipient) {


        // Lister les membres d'équipe disponibles
        const availableMembers = await User.find({
          role: {
            $in: ['admin', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'support']
          },
          isActive: true
        }).select('_id email nom prenom role').limit(10).lean();


        availableMembers.forEach(m => {

        });

        throw new Error(`Utilisateur destinataire introuvable (ID: ${recipientId}). Veuillez sélectionner un membre valide de l'équipe.`);
      }



      // ========== VÉRIFICATIONS MÉTIER ==========

      // Vérifier que les utilisateurs sont actifs
      if (!user.isActive) {

        throw new Error('Votre compte est inactif. Contactez l\'administrateur.');
      }

      if (!recipient.isActive) {

        throw new Error(`Le membre ${recipient.prenom} ${recipient.nom} n'est plus disponible.`);
      }

      // Vérifier que le destinataire est bien un membre de l'équipe (TOUS les rôles sauf client)
      const allowedRoles = [
        'admin', 'conseiller', 'rm', 'dce', 'adg', 'dga',
        'risques', 'support', 'gestionnaire', 'commercial',
        'controleur', 'superviseur', 'operateur', 'auditeur'
      ];

      if (!allowedRoles.includes(recipient.role)) {

        throw new Error('Vous ne pouvez contacter que les membres de l\'équipe.');
      }



      // ========== VÉRIFIER CONVERSATION EXISTANTE ==========

      let conversation = await Conversation.findOne({
        participants: {
          $all: [
            new mongoose.Types.ObjectId(userId),
            new mongoose.Types.ObjectId(recipientId)
          ],
          $size: 2
        },
        type: 'direct',
        isArchived: false
      });

      if (conversation) {


        // Envoyer le message dans la conversation existante
        if (firstMessage && firstMessage.trim()) {

          await this.sendSimpleMessage(
            conversation._id,
            userId,
            firstMessage
          );
        }

        return conversation;
      }

      // ========== CRÉER NOUVELLE CONVERSATION ==========



      conversation = await Conversation.create({
        participants: [userId, recipientId],
        type: 'direct',
        title: subject || `${user.prenom} ${user.nom} - ${recipient.prenom} ${recipient.nom}`,
        createdBy: userId,
        metadata: {
          priority: 'medium',
          createdAt: new Date()
        },
        lastActivityAt: new Date()
      });



      // ========== ENVOYER LE PREMIER MESSAGE ==========

      if (firstMessage && firstMessage.trim()) {


        await this.sendSimpleMessage(
          conversation._id,
          userId,
          firstMessage
        );


      }

      return conversation;

    } catch (error) {

      throw error;
    }
  }

  /**
   * Un client démarre une conversation avec le support général
   * (quand il ne sait pas à qui s'adresser)
   */
  async startSupportConversation(clientId, subject, firstMessage) {
    try {
      const client = await User.findById(clientId);
      if (!client) {
        throw new Error('Client non trouvé');
      }

      // Trouver un conseiller disponible (ou celui assigné au client)
      let conseiller = null;
      if (client.conseillerId) {
        conseiller = await User.findById(client.conseillerId);
      }

      // Si pas de conseiller assigné, prendre un conseiller disponible
      if (!conseiller) {
        conseiller = await User.findOne({
          role: 'conseiller',
          isActive: true
        }).sort({ updatedAt: 1 }); // Le moins récemment actif
      }

      if (!conseiller) {
        throw new Error('Aucun conseiller disponible');
      }

      // Utiliser la fonction direct conversation
      return await this.startDirectConversation(
        clientId,
        conseiller._id,
        firstMessage,
        subject
      );

    } catch (error) {

      throw error;
    }
  }

  /**
   * Chat lié à une demande de forçage
   * Le client peut discuter avec son conseiller sur une demande spécifique
   */
  async getDemandeChat(demandeId, userId) {
    try {
      const demande = await DemandeForçage.findById(demandeId)
        .populate('clientId', 'nom prenom email')
        .populate('conseillerId', 'nom prenom email');

      if (!demande) {
        throw new Error('Demande non trouvée');
      }

      // Vérifier que l'utilisateur est concerné par cette demande
      const isClient = demande.clientId._id.toString() === userId.toString();
      const isConseiller = demande.conseillerId._id.toString() === userId.toString();
      const user = await User.findById(userId);
      const isAdmin = user && ['admin', 'dga', 'risques', 'rm', 'dce', 'adg'].includes(user.role);

      if (!isClient && !isConseiller && !isAdmin) {
        throw new Error('Accès non autorisé à cette conversation');
      }

      // Chercher ou créer la conversation
      let conversation = await Conversation.findOne({
        demandeId,
        type: 'demande'
      });

      if (!conversation) {
        // Créer la conversation
        const participants = [demande.clientId._id, demande.conseillerId._id];

        // Ajouter l'admin/risques s'il demande
        if (isAdmin && !participants.includes(userId)) {
          participants.push(userId);
        }

        conversation = await Conversation.create({
          participants,
          type: 'demande',
          demandeId,
          title: `Discussion - Demande #${demande.numeroReference}`,
          createdBy: userId,
          metadata: {
            priority: 'high',
            demandeReference: demande.numeroReference,
            montant: demande.montant
          }
        });

        // Message de bienvenue
        await Message.create({
          conversationId: conversation._id,
          sender: demande.conseillerId._id,
          content: `Bonjour ${demande.clientId.prenom}, je suis ${demande.conseillerId.prenom} ${demande.conseillerId.nom}, votre conseiller. Je suis là pour vous accompagner dans votre demande de forçage.`,
          type: 'system'
        });
      }

      return conversation;

    } catch (error) {

      throw error;
    }
  }

  // ==================== MESSAGES ====================

  /**
   * Envoyer un message simple
   * Pas de complexité inutile
   */
  async sendSimpleMessage(conversationId, senderId, content, attachments = []) {
    try {


      // Vérifier l'accès
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: senderId
      });

      if (!conversation) {
        throw new Error('Accès refusé ou conversation non trouvée');
      }

      // Nettoyer le contenu
      const cleanContent = content.trim();

      if (!cleanContent && attachments.length === 0) {
        throw new Error('Le message ne peut pas être vide');
      }

      // Créer le message
      const message = await Message.create({
        conversationId,
        sender: senderId,
        content: cleanContent,
        type: attachments.length > 0 ? 'file' : 'text',
        attachments: attachments.map(att => ({
          filename: att.filename,
          url: att.url,
          type: this.getFileType(att.filename),
          size: att.size
        }))
      });



      // Mettre à jour la conversation
      conversation.lastMessage = {
        sender: senderId,
        content: cleanContent.substring(0, 100),
        createdAt: new Date()
      };

      conversation.lastActivityAt = new Date();

      // Incrémenter le compteur non lu pour l'autre personne
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== senderId.toString()) {
          const count = conversation.unreadCount.get(participantId.toString()) || 0;
          conversation.unreadCount.set(participantId.toString(), count + 1);
        }
      });

      await conversation.save();

      // Peupler les infos de l'expéditeur
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'nom prenom avatar role')
        .lean();

      return populatedMessage;

    } catch (error) {

      throw error;
    }
  }

  /**
   * Récupérer les messages d'une conversation
   * Simple pagination comme WhatsApp
   */
  async getMessages(conversationId, userId, limit = 50, beforeDate = null) {
    try {
      // Vérifier l'accès
      const hasAccess = await Conversation.exists({
        _id: conversationId,
        participants: userId
      });

      if (!hasAccess) {
        throw new Error('Accès refusé');
      }

      let query = { conversationId };

      if (beforeDate) {
        query.createdAt = { $lt: new Date(beforeDate) };
      }

      // Récupérer les messages avec populate
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('sender', 'nom prenom avatar role email')
        .lean();

      // Marquer comme lu
      await this.markAsRead(conversationId, userId);

      // Retourner du plus ancien au plus récent (comme WhatsApp)
      return messages.reverse();

    } catch (error) {
      throw error;
    }
  }

  /**
   * Marquer une conversation comme lue
   */
  async markAsRead(conversationId, userId) {
    try {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation || !conversation.participants.includes(userId)) {
        return;
      }

      // Réinitialiser le compteur
      conversation.unreadCount.set(userId.toString(), 0);
      await conversation.save();

    } catch (error) {

    }
  }

  // ==================== LISTE DES CONVERSATIONS ====================

  /**
   * Récupérer la liste des membres de l'équipe disponibles
   * Pour que le client puisse choisir à qui écrire
   */
  async getAvailableTeamMembers(userId = null) {
    try {


      // TOUS LES RÔLES POSSIBLES de votre application (sauf client)
      const query = {
        role: {
          $in: [
            'admin', 'conseiller', 'rm', 'dce', 'adg', 'dga',
            'risques', 'support', 'gestionnaire', 'commercial',
            'controleur', 'superviseur', 'operateur', 'auditeur'
          ]
        },
        isActive: true
      };



      // Récupération de TOUS les champs nécessaires
      const members = await User.find(query)
        .select('nom prenom email role avatar telephone statut isActive createdAt')
        .sort({ role: 1, nom: 1 })
        .lean();



      // Debug: afficher chaque membre trouvé
      members.forEach(m => {

      });

      // Si l'utilisateur est connecté, vérifier son conseiller assigné
      let assignedConseillerId = null;
      if (userId) {
        const user = await User.findById(userId).select('conseillerId').lean();
        assignedConseillerId = user?.conseillerId;

      }

      // Formater pour le frontend avec gestion des valeurs manquantes
      const formattedMembers = members.map(member => {
        const isAssigned = assignedConseillerId &&
          assignedConseillerId.toString() === member._id.toString();

        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((member.prenom || '') + '+' + (member.nom || ''))}&background=random&size=128`;

        const isAvailable = (
          (member.isActive === true) &&
          (member.statut === 'actif' || member.statut === 'disponible' || !member.statut)
        );

        return {
          id: member._id,
          _id: member._id, // Inclure les deux formats pour compatibilité
          nom: member.nom || '',
          prenom: member.prenom || '',
          nomComplet: `${member.prenom || ''} ${member.nom || ''}`.trim(),
          email: member.email || '',
          role: member.role,
          roleLabel: this.getRoleLabel(member.role),
          avatar: member.avatar || defaultAvatar,
          telephone: member.telephone || 'Non renseigné',
          isAssigned: isAssigned,
          isAvailable: isAvailable,
          statut: member.statut || 'inconnu'
        };
      });



      // Retourner les membres triés par priorité de rôle
      return this.sortMembersByRolePriority(formattedMembers);

    } catch (error) {

      throw error;
    }
  }

  /**
   * Récupérer les conversations d'un utilisateur
   */
  async getUserConversations(userId, { limit = 20, page = 1, archived = false } = {}) {
    try {
      const skip = (page - 1) * limit;

      // Ne pas utiliser .lean() pour préserver les Maps
      const conversations = await Conversation.find({
        participants: userId,
        isArchived: archived
      })
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'participants',
          select: 'nom prenom avatar role',
          match: { _id: { $ne: userId } }
        })
        .populate('demandeId', 'numeroReference montant statut');

      // Formater les conversations
      const formattedConversations = conversations.map(conv => {
        const convObj = conv.toObject ? conv.toObject() : conv;
        
        // Gérer unreadCount - peut être une Map ou un objet
        let unreadCount = 0;
        if (conv.unreadCount) {
          if (typeof conv.unreadCount.get === 'function') {
            // C'est une Map
            unreadCount = conv.unreadCount.get(userId.toString()) || 0;
          } else if (typeof conv.unreadCount === 'object') {
            // C'est un objet plain
            unreadCount = conv.unreadCount[userId.toString()] || 0;
          }
        }
        
        convObj.unreadCount = unreadCount;
        convObj.participants = (convObj.participants || []).filter(p => p !== null);

        if (!convObj.title && convObj.participants.length > 0) {
          const other = convObj.participants[0];
          convObj.title = `${other.prenom} ${other.nom}`;
        }

        return convObj;
      });

      const total = await Conversation.countDocuments({
        participants: userId,
        isArchived: archived
      });

      return {
        conversations: formattedConversations,
        total,
        page,
        pages: Math.ceil(total / limit)
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Compter les messages non lus au total
   */
  async getTotalUnreadCount(userId) {
    try {
      const conversations = await Conversation.find({
        participants: userId,
        isArchived: false
      }).select('unreadCount');

      let total = 0;
      conversations.forEach(conv => {
        if (conv.unreadCount) {
          if (typeof conv.unreadCount.get === 'function') {
            // C'est une Map
            total += conv.unreadCount.get(userId.toString()) || 0;
          } else if (typeof conv.unreadCount === 'object') {
            // C'est un objet plain
            total += conv.unreadCount[userId.toString()] || 0;
          }
        }
      });

      return total;

    } catch (error) {
      return 0;
    }
  }

  // ==================== UTILITAIRES ====================

  getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
      pdf: 'document', doc: 'document', docx: 'document',
      xls: 'document', xlsx: 'document',
      zip: 'archive', rar: 'archive'
    };
    return types[ext] || 'file';
  }

  getRoleLabel(role) {
    const roleLabels = {
      'admin': 'Administrateur Système',
      'conseiller': 'Conseiller Clientèle',
      'rm': 'Risk Manager (Responsable d\'Agence)',
      'dce': 'Directeur Commercial d\'Exploitation',
      'adg': 'Assistant Directeur Général',
      'dga': 'Directeur Général Adjoint',
      'risques': 'Analyste Risques',
      'support': 'Support Technique',
      'gestionnaire': 'Gestionnaire',
      'commercial': 'Commercial',
      'controleur': 'Contrôleur',
      'superviseur': 'Superviseur',
      'operateur': 'Opérateur',
      'auditeur': 'Auditeur',
      'client': 'Client'
    };

    return roleLabels[role] || role.charAt(0).toUpperCase() + role.slice(1);
  }

  sortMembersByRolePriority(members) {
    const rolePriority = {
      'admin': 1, 'dga': 2, 'adg': 3, 'dce': 4, 'rm': 5,
      'risques': 6, 'conseiller': 7, 'superviseur': 8,
      'controleur': 9, 'gestionnaire': 10, 'commercial': 11,
      'support': 12, 'operateur': 13, 'auditeur': 14
    };

    return members.sort((a, b) => {
      const priorityA = rolePriority[a.role] || 99;
      const priorityB = rolePriority[b.role] || 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.nomComplet.localeCompare(b.nomComplet);
    });
  }
}

module.exports = new ChatService();