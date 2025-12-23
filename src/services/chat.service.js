// src/services/chat.service.js - VERSION COMPLÈTE CORRIGÉE
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const DemandeForçage = require('../models/DemandeForçage');

class ChatService {
  
  // ==================== CONVERSATIONS ====================
  
  /**
   * Démarrer une conversation avec un membre précis de l'équipe
   * Le client peut choisir avec qui il veut parler
   */
  async startDirectConversation(userId, recipientId, firstMessage, subject = null) {
    try {
      const user = await User.findById(userId);
      const recipient = await User.findById(recipientId);
      
      if (!user || !recipient) {
        throw new Error('Utilisateur non trouvé');
      }
      
      // Vérifier que le destinataire est bien un membre de l'équipe (TOUS les rôles sauf client)
      const allowedRoles = ['admin', 'conseiller', 'rm', 'dce', 'adg', 'dga', 'risques', 'support', 'gestionnaire', 'commercial', 'controleur', 'superviseur', 'operateur', 'auditeur'];
      if (!allowedRoles.includes(recipient.role)) {
        throw new Error('Vous ne pouvez contacter que les membres de l\'équipe');
      }
      
      // Vérifier si une conversation existe déjà entre ces 2 personnes
      let conversation = await Conversation.findOne({
        participants: { $all: [userId, recipientId], $size: 2 },
        type: 'direct',
        isArchived: false
      });
      
      // Si pas de conversation, en créer une
      if (!conversation) {
        conversation = await Conversation.create({
          participants: [userId, recipientId],
          type: 'direct',
          title: subject || `${user.prenom} ${user.nom} - ${recipient.prenom} ${recipient.nom}`,
          createdBy: userId,
          metadata: {
            priority: 'medium'
          }
        });
        
        console.log(`✅ Conversation créée: ${user.nom} -> ${recipient.nom}`);
      }
      
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
      console.error('❌ Erreur création conversation directe:', error);
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
      console.error('❌ Erreur création conversation support:', error);
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
      console.error('❌ Erreur chat demande:', error);
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
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer les messages d'une conversation
   * Simple pagination
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
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('sender', 'nom prenom avatar role')
        .lean();
      
      // Marquer comme lu
      await this.markAsRead(conversationId, userId);
      
      // Retourner du plus ancien au plus récent
      return messages.reverse();
      
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
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
      console.error('❌ Erreur marquer comme lu:', error);
    }
  }
  
  // ==================== LISTE DES CONVERSATIONS ====================
  
  /**
   * Récupérer la liste des membres de l'équipe disponibles
   * Pour que le client puisse choisir à qui écrire
   */
  async getAvailableTeamMembers(userId = null) {
    try {
      console.log('🔍 Recherche membres équipe pour le chat...');
      
      // TOUS LES RÔLES POSSIBLES de votre application (sauf client)
      const query = {
        role: { 
          $in: [
            'admin',           // Administrateur
            'conseiller',      // Conseiller Clientèle
            'rm',              // Risk Manager (Responsable d'Agence)
            'dce',             // Directeur Commercial d'Exploitation
            'adg',             // Assistant Directeur Général
            'dga',             // Directeur Général Adjoint
            'risques',         // Analyste Risques
            'support',         // Support Technique
            'gestionnaire',    // Gestionnaire (si existant)
            'commercial',      // Commercial (si existant)
            'controleur',      // Contrôleur (si existant)
            'superviseur',     // Superviseur (si existant)
            'operateur',       // Opérateur (si existant)
            'auditeur'         // Auditeur (si existant)
          ] 
        },
        isActive: true
      };
      
      console.log('📋 Query roles:', query.role.$in);
      
      // Récupération de TOUS les champs nécessaires
      const members = await User.find(query)
        .select('nom prenom email role avatar telephone statut isActive createdAt')
        .sort({ 
          // Ordre hiérarchique logique
          role: 1, 
          // Dans l'ordre: admin, conseiller, rm, dce, adg, dga, risques, support, autres
          nom: 1 
        })
        .lean();
      
      console.log(`📊 ${members.length} membres trouvés pour le chat`);
      
      // Debug: afficher chaque membre trouvé
      members.forEach(m => {
        console.log(`   - ${m.prenom} ${m.nom} (${m.role}) - actif: ${m.isActive}, statut: ${m.statut}`);
      });
      
      // Si l'utilisateur est connecté, vérifier son conseiller assigné
      let assignedConseillerId = null;
      if (userId) {
        const user = await User.findById(userId).select('conseillerId').lean();
        assignedConseillerId = user?.conseillerId;
        console.log('👤 User ID:', userId, 'Conseiller assigné:', assignedConseillerId);
      }
      
      // Formater pour le frontend avec gestion des valeurs manquantes
      const formattedMembers = members.map(member => {
        const isAssigned = assignedConseillerId && 
                          assignedConseillerId.toString() === member._id.toString();
        
        // Avatar par défaut si manquant
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((member.prenom || '') + '+' + (member.nom || ''))}&background=random&size=128`;
        
        // Déterminer si disponible (multiple critères)
        const isAvailable = (
          (member.isActive === true) && 
          (member.statut === 'actif' || member.statut === 'disponible' || !member.statut)
        );
        
        return {
          id: member._id,
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
      
      console.log(`✅ ${formattedMembers.length} membres formatés pour le frontend`);
      
      // Retourner les membres triés par priorité de rôle
      return this.sortMembersByRolePriority(formattedMembers);
      
    } catch (error) {
      console.error('❌ Erreur récupération équipe:', error);
      throw error;
    }
  }
  
  /**
   * Récupérer les conversations d'un utilisateur
   * Trié par dernière activité
   */
  async getUserConversations(userId, { limit = 20, page = 1, archived = false } = {}) {
    try {
      const skip = (page - 1) * limit;
      
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
        match: { _id: { $ne: userId } } // Ne pas inclure l'utilisateur lui-même
      })
      .populate('demandeId', 'numeroReference montant statut')
      .lean();
      
      // Ajouter le compteur de messages non lus
      conversations.forEach(conv => {
        conv.unreadCount = conv.unreadCount?.get(userId.toString()) || 0;
        
        // Nettoyer les participants null
        conv.participants = conv.participants.filter(p => p !== null);
        
        // Générer un titre si absent
        if (!conv.title && conv.participants.length > 0) {
          const other = conv.participants[0];
          conv.title = `${other.prenom} ${other.nom}`;
        }
      });
      
      const total = await Conversation.countDocuments({
        participants: userId,
        isArchived: archived
      });
      
      return {
        conversations,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
      
    } catch (error) {
      console.error('❌ Erreur récupération conversations:', error);
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
        total += conv.unreadCount?.get(userId.toString()) || 0;
      });
      
      return total;
      
    } catch (error) {
      console.error('❌ Erreur comptage non lus:', error);
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
  
  // Nouvelle méthode pour trier par priorité de rôle
  sortMembersByRolePriority(members) {
    const rolePriority = {
      'admin': 1,
      'dga': 2,
      'adg': 3,
      'dce': 4,
      'rm': 5,
      'risques': 6,
      'conseiller': 7,
      'superviseur': 8,
      'controleur': 9,
      'gestionnaire': 10,
      'commercial': 11,
      'support': 12,
      'operateur': 13,
      'auditeur': 14
    };
    
    return members.sort((a, b) => {
      const priorityA = rolePriority[a.role] || 99;
      const priorityB = rolePriority[b.role] || 99;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Si même rôle, trier par nom
      return a.nomComplet.localeCompare(b.nomComplet);
    });
  }
}

module.exports = new ChatService();