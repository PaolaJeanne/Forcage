// src/controllers/index.js - FICHIER D'EXPORT DES CONTRÔLEURS
const demandeForçageController = require('./demandeForçage.controller');

// Extraire les méthodes de l'instance
module.exports = {
  // Méthodes de demandeForçage
  creerDemande: demandeForçageController.creerDemande.bind(demandeForçageController),
  listerDemandes: demandeForçageController.listerDemandes.bind(demandeForçageController),
  getDemande: demandeForçageController.getDemande.bind(demandeForçageController),
  soumettreDemande: demandeForçageController.soumettreDemande.bind(demandeForçageController),
  annulerDemande: demandeForçageController.annulerDemande.bind(demandeForçageController),
  traiterDemande: demandeForçageController.traiterDemande.bind(demandeForçageController),
  remonterDemande: demandeForçageController.remonterDemande.bind(demandeForçageController),
  regulariser: demandeForçageController.regulariser.bind(demandeForçageController),
  getStatistiques: demandeForçageController.getStatistiques.bind(demandeForçageController),
  mettreAJourDemande: demandeForçageController.mettreAJourDemande.bind(demandeForçageController),
  
  // Exporter aussi l'instance complète si besoin
  demandeForçageController: demandeForçageController
};