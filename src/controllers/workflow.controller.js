// src/controllers/workflow.controller.js
const DemandeForçage = require('../models/DemandeForçage');
const User = require('../models/User');
const AuditService = require('../services/audit.service');

class WorkflowController {

  /**
   * VALIDER une demande
   * Route: PATCH /api/v1/demandes/:id/valider
   */
  async valider(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;
      const userId = req.user.userId;

      // Récupérer la demande
      const demande = await DemandeForçage.findById(id)
        .populate('clientId', 'nom prenom notationClient')
        .populate('conseillerId', 'nom prenom role limiteAutorisation');

      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      // Vérifier les permissions
      const user = await User.findById(userId);
      const userRole = user.role;
      const userLimite = user.limiteAutorisation || 0;

      // Logique de permission basée sur le statut actuel
      let canValidate = false;
      let newStatut = demande.statut;
      let nextRole = null;

      switch (demande.statut) {
        case 'EN_ETUDE_CONSEILLER':
          // Conseiller peut valider si dans sa limite
          if (userRole === 'conseiller' && user._id.toString() === demande.conseillerId._id.toString()) {
            if (demande.montant <= userLimite) {
              canValidate = true;
              newStatut = 'APPROUVEE';
            } else {
              canValidate = true;
              newStatut = 'EN_ATTENTE_RM';
              nextRole = 'rm';
            }
          }
          break;

        case 'EN_ATTENTE_RM':
          if (userRole === 'rm') {
            if (demande.montant <= userLimite) {
              canValidate = true;
              newStatut = 'APPROUVEE';
            } else {
              canValidate = true;
              newStatut = 'EN_ATTENTE_DCE';
              nextRole = 'dce';
            }
          }
          break;

        case 'EN_ATTENTE_DCE':
          if (userRole === 'dce') {
            if (demande.montant <= userLimite) {
              canValidate = true;
              newStatut = 'APPROUVEE';
            } else {
              canValidate = true;
              newStatut = 'EN_ATTENTE_ADG';
              nextRole = 'adg';
            }
          }
          break;

        case 'EN_ATTENTE_ADG':
          if (userRole === 'adg') {
            canValidate = true;
            newStatut = 'APPROUVEE';
          }
          break;

        case 'EN_ANALYSE_RISQUES':
          if (userRole === 'risques') {
            canValidate = true;
            newStatut = 'APPROUVEE';
          }
          break;

        case 'APPROUVEE':
          // Déjà approuvée
          return res.status(400).json({
            success: false,
            message: 'Cette demande est déjà approuvée'
          });
      }

      if (!canValidate) {
        return res.status(403).json({
          success: false,
          message: `Vous n'avez pas la permission de valider cette demande (${demande.statut})`
        });
      }

      // Mettre à jour la demande
      const ancienStatut = demande.statut;

      demande.statut = newStatut;
      demande.historiqueValidations.push({
        role: userRole,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'VALIDATION',
        commentaire: commentaire || 'Validation',
        date: new Date()
      });

      if (nextRole) {
        demande.currentHandler = nextRole;
      } else {
        demande.currentHandler = null;
      }

      // Si approuvée, ajouter la date d'approbation
      if (newStatut === 'APPROUVEE') {
        demande.dateApprobation = new Date();
        demande.approuveePar = user._id;
      }

      await demande.save();

      // Audit
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'VALIDER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          nouveauStatut: newStatut,
          montant: demande.montant
        },
        ip: req.ip
      });

      // TODO: Notification
      // await NotificationService.notifyDemandeApprouvee(demande, user);

      res.json({
        success: true,
        message: `Demande validée (${ancienStatut} → ${newStatut})`,
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            statut: demande.statut,
            montant: demande.montant,
            currentHandler: demande.currentHandler
          },
          validateur: {
            nom: user.nom,
            prenom: user.prenom,
            role: user.role
          }
        }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * REJETER une demande
   * Route: PATCH /api/v1/demandes/:id/rejeter
   */
  async rejeter(req, res) {
    try {
      const { id } = req.params;
      const { motif } = req.body;
      const userId = req.user.userId;

      if (!motif) {
        return res.status(400).json({
          success: false,
          message: 'Le motif de rejet est obligatoire'
        });
      }

      const demande = await DemandeForçage.findById(id);
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      const user = await User.findById(userId);

      // Vérifier si l'utilisateur peut rejeter
      const statutsRejetables = [
        'EN_ETUDE_CONSEILLER',
        'EN_ATTENTE_RM',
        'EN_ATTENTE_DCE',
        'EN_ATTENTE_ADG',
        'EN_ANALYSE_RISQUES'
      ];

      if (!statutsRejetables.includes(demande.statut)) {
        return res.status(400).json({
          success: false,
          message: `Impossible de rejeter une demande avec le statut ${demande.statut}`
        });
      }

      // Vérifier les permissions par statut
      let canReject = false;

      switch (demande.statut) {
        case 'EN_ETUDE_CONSEILLER':
          canReject = ['conseiller', 'admin'].includes(user.role);
          break;
        case 'EN_ATTENTE_RM':
          canReject = ['rm', 'admin'].includes(user.role);
          break;
        case 'EN_ATTENTE_DCE':
          canReject = ['dce', 'admin'].includes(user.role);
          break;
        case 'EN_ATTENTE_ADG':
          canReject = ['adg', 'admin'].includes(user.role);
          break;
        case 'EN_ANALYSE_RISQUES':
          canReject = ['risques', 'admin'].includes(user.role);
          break;
      }

      if (!canReject) {
        return res.status(403).json({
          success: false,
          message: `Vous n'avez pas la permission de rejeter cette demande`
        });
      }

      const ancienStatut = demande.statut;
      demande.statut = 'REJETEE';
      demande.dateRejet = new Date();
      demande.rejeteePar = user._id;
      demande.motifRejet = motif;

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'REJET',
        commentaire: motif,
        date: new Date()
      });

      await demande.save();

      // Audit
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'REJETER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          motifRejet: motif,
          montant: demande.montant
        },
        ip: req.ip
      });

      // TODO: Notification
      // await NotificationService.notifyDemandeRejetee(demande, user);

      res.json({
        success: true,
        message: 'Demande rejetée',
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            statut: demande.statut,
            motifRejet: motif
          },
          rejeteur: {
            nom: user.nom,
            prenom: user.prenom,
            role: user.role
          }
        }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors du rejet',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * REMONTER une demande manuellement
   * Route: PATCH /api/v1/demandes/:id/remonter
   */
  async remonter(req, res) {
    try {
      const { id } = req.params;
      const { commentaire, niveau } = req.body;
      const userId = req.user.userId;

      const demande = await DemandeForçage.findById(id);
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      const user = await User.findById(userId);

      // Déterminer le prochain niveau
      let nouveauStatut;
      let currentHandler;

      if (niveau) {
        // Si niveau spécifié
        switch (niveau.toUpperCase()) {
          case 'RM':
            nouveauStatut = 'EN_ATTENTE_RM';
            currentHandler = 'rm';
            break;
          case 'DCE':
            nouveauStatut = 'EN_ATTENTE_DCE';
            currentHandler = 'dce';
            break;
          case 'ADG':
            nouveauStatut = 'EN_ATTENTE_ADG';
            currentHandler = 'adg';
            break;
          case 'RISQUES':
            nouveauStatut = 'EN_ANALYSE_RISQUES';
            currentHandler = 'risques';
            break;
          default:
            return res.status(400).json({
              success: false,
              message: 'Niveau invalide. Valeurs acceptées: RM, DCE, ADG, RISQUES'
            });
        }
      } else {
        // Si pas de niveau, déterminer automatiquement
        switch (demande.statut) {
          case 'EN_ETUDE_CONSEILLER':
            if (demande.montant <= 500000) {
              // Dans la limite conseiller
              return res.status(400).json({
                success: false,
                message: 'Cette demande peut être traitée par le conseiller. Utilisez /valider.'
              });
            }
            nouveauStatut = 'EN_ATTENTE_RM';
            currentHandler = 'rm';
            break;

          case 'EN_ATTENTE_RM':
            nouveauStatut = 'EN_ATTENTE_DCE';
            currentHandler = 'dce';
            break;

          case 'EN_ATTENTE_DCE':
            nouveauStatut = 'EN_ATTENTE_ADG';
            currentHandler = 'adg';
            break;

          default:
            return res.status(400).json({
              success: false,
              message: `Impossible de remonter depuis le statut ${demande.statut}`
            });
        }
      }

      // Mettre à jour la demande
      const ancienStatut = demande.statut;

      demande.statut = nouveauStatut;
      demande.currentHandler = currentHandler;

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'REMONTEE',
        commentaire: commentaire || `Remontée à ${currentHandler.toUpperCase()}`,
        date: new Date()
      });

      await demande.save();

      // Audit
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'REMONTER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          nouveauStatut,
          currentHandler
        },
        ip: req.ip
      });

      res.json({
        success: true,
        message: `Demande remontée à ${currentHandler.toUpperCase()}`,
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            ancienStatut,
            nouveauStatut,
            currentHandler
          }
        }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la remontée',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * RETOURNER une demande pour complément
   * Route: PATCH /api/v1/demandes/:id/retourner
   */
  async retourner(req, res) {
    try {
      const { id } = req.params;
      const { motifs, instructions } = req.body;
      const userId = req.user.userId;

      if (!motifs || !Array.isArray(motifs) || motifs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Les motifs de retour sont obligatoires (tableau)'
        });
      }

      const demande = await DemandeForçage.findById(id);
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      const user = await User.findById(userId);

      // Vérifier les permissions (seuls les validateurs peuvent retourner)
      const statutsRetournables = [
        'EN_ETUDE_CONSEILLER',
        'EN_ATTENTE_RM',
        'EN_ATTENTE_DCE',
        'EN_ATTENTE_ADG'
      ];

      if (!statutsRetournables.includes(demande.statut)) {
        return res.status(400).json({
          success: false,
          message: `Impossible de retourner une demande avec le statut ${demande.statut}`
        });
      }

      // Déterminer où retourner
      let nouveauStatut = 'EN_ATTENTE_CONSEILLER';

      // Mettre à jour la demande
      const ancienStatut = demande.statut;

      demande.statut = nouveauStatut;
      demande.estRetournee = true;
      demande.motifsRetour = motifs;
      demande.instructionsRetour = instructions;
      demande.dateRetour = new Date();
      demande.retournePar = user._id;

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'RETOUR',
        commentaire: `Demande retournée: ${motifs.join(', ')}`,
        date: new Date()
      });

      await demande.save();

      // Audit
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'RETOURNER_DEMANDE',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          nouveauStatut,
          motifs,
          instructions
        },
        ip: req.ip
      });

      // TODO: Notification au client

      res.json({
        success: true,
        message: 'Demande retournée pour complément',
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            ancienStatut,
            nouveauStatut,
            motifsRetour: motifs,
            instructionsRetour: instructions
          },
          retourneur: {
            nom: user.nom,
            prenom: user.prenom,
            role: user.role
          }
        }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors du retour',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Envoyer en analyse risques
   * Route: PATCH /api/v1/demandes/:id/analyse-risques
   */
  async envoyerAnalyseRisques(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;
      const userId = req.user.userId;

      const demande = await DemandeForçage.findById(id);
      if (!demande) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      const user = await User.findById(userId);

      // Vérifier les permissions (conseiller, RM, admin)
      if (!['conseiller', 'rm', 'admin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les conseillers et RM peuvent envoyer en analyse risques'
        });
      }

      // Vérifier le statut actuel
      const statutsValides = ['EN_ETUDE_CONSEILLER', 'EN_ATTENTE_RM'];
      if (!statutsValides.includes(demande.statut)) {
        return res.status(400).json({
          success: false,
          message: `Impossible d'envoyer en analyse risques depuis le statut ${demande.statut}`
        });
      }

      // Mettre à jour la demande
      const ancienStatut = demande.statut;

      demande.statut = 'EN_ANALYSE_RISQUES';
      demande.currentHandler = 'risques';

      demande.historiqueValidations.push({
        role: user.role,
        userId: user._id,
        nom: user.nom,
        prenom: user.prenom,
        action: 'ANALYSE_RISQUES',
        commentaire: commentaire || 'Envoyée en analyse risques',
        date: new Date()
      });

      await demande.save();

      // Audit
      await AuditService.logAction({
        userId: user._id,
        userNom: `${user.prenom} ${user.nom}`,
        userRole: user.role,
        action: 'ENVOYER_ANALYSE_RISQUES',
        details: {
          demandeId: demande._id,
          numeroReference: demande.numeroReference,
          ancienStatut,
          nouveauStatut: 'EN_ANALYSE_RISQUES',
          montant: demande.montant,
          notationClient: demande.clientId.notationClient
        },
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Demande envoyée en analyse risques',
        data: {
          demande: {
            id: demande._id,
            numeroReference: demande.numeroReference,
            ancienStatut,
            nouveauStatut: demande.statut,
            currentHandler: demande.currentHandler
          }
        }
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi en analyse risques',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new WorkflowController();