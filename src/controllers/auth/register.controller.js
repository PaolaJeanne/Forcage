// src/controllers/auth/register.controller.js - Inscription publique
const User = require('../../models/User');
const { successResponse, errorResponse } = require('../../utils/response.util');
const NotificationService = require('../../services/notification.service');

// ============================================
// INSCRIPTION PUBLIQUE (pour les clients)
// ============================================
const register = async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, numeroCompte, cni } = req.body;

    console.log('REGISTER ATTEMPT:', { nom, prenom, email, telephone, numeroCompte, cni });

    // Validation détaillée
    const missingFields = [];
    if (!nom) missingFields.push('nom');
    if (!prenom) missingFields.push('prenom');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');

    if (missingFields.length > 0) {
      return errorResponse(res, 400, `Champs obligatoires manquants: ${missingFields.join(', ')}`);
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'Le mot de passe doit contenir au moins 6 caractères');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Cet email est déjà utilisé');
    }

    const user = new User({
      nom,
      prenom,
      email,
      password,
      telephone,
      numeroCompte,
      numeroCNI: cni,
      role: 'client',
      limiteAutorisation: 0,
      classification: 'normal',
      notationClient: 'C',
      kycValide: false,
      agence: null,
      agencyId: null
    });

    await user.save();

    // ✅ Envoyer une notification de bienvenue
    try {
      await NotificationService.createNotification({
        utilisateur: user._id,
        type: 'system',
        titre: 'Bienvenue sur CreditApp',
        message: `Bienvenue ${user.prenom} ! Votre compte a été créé avec succès.`,
        priorite: 'normale',
        categorie: 'system'
      });
    } catch (notificationError) {
      console.error('⚠️ Erreur notification bienvenue:', notificationError);
    }

    return successResponse(res, 201, 'Inscription réussie', {
      user: {
        id: user._id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        telephone: user.telephone,
        numeroCompte: user.numeroCompte,
        cni: user.numeroCNI
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);
    return errorResponse(res, 500, 'Erreur lors de l\'inscription');
  }
};

module.exports = {
  register
};
