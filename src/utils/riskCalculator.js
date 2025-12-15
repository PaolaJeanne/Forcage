// src/utils/riskCalculator.js
const calculerScoreRisque = (client, montant, historiqueClient = []) => {
  let score = 0;
  
  // 1. Notation client (40% du score)
  const notations = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
  score += (notations[client.notationClient] || 3) * 4;
  
  // 2. Classification client (30% du score)
  const classifications = { 
    'normal': 1, 
    'sensible': 3, 
    'restructure': 4, 
    'defaut': 5 
  };
  score += (classifications[client.classification] || 1) * 3;
  
  // 3. Montant relatif (20% du score)
  const ratioMontant = montant / (client.soldeActuel + client.decouvertAutorise || 1);
  if (ratioMontant > 1.5) score += 5 * 2;
  else if (ratioMontant > 1) score += 3 * 2;
  else if (ratioMontant > 0.5) score += 2 * 2;
  
  // 4. Historique (10% du score)
  const demandesValidees = historiqueClient.filter(d => d.statut === 'VALIDEE').length;
  const demandesRefusees = historiqueClient.filter(d => d.statut === 'REFUSEE').length;
  
  if (demandesRefusees > 0) score += 3;
  if (demandesValidees > 5) score -= 2; // Bonus pour bon historique
  
  // Normaliser le score (0-100)
  const scoreNormalise = Math.min(100, Math.max(0, score));
  
  // Déterminer le niveau de risque
  if (scoreNormalise >= 80) return 'CRITIQUE';
  if (scoreNormalise >= 60) return 'ELEVE';
  if (scoreNormalise >= 40) return 'MOYEN';
  return 'FAIBLE';
};

const determinerPriorite = (scoreRisque, montant, dateCreation) => {
  const maintenant = new Date();
  const delaiCreation = maintenant - new Date(dateCreation);
  const heuresEcoulees = delaiCreation / (1000 * 60 * 60);
  
  // Critères de priorité
  if (scoreRisque === 'CRITIQUE') return 'URGENTE';
  if (montant > 20000000) return 'URGENTE';
  if (heuresEcoulees > 48) return 'URGENTE'; // Plus de 2 jours
  if (scoreRisque === 'ELEVE' && montant > 5000000) return 'URGENTE';
  
  return 'NORMALE';
};

module.exports = {
  calculerScoreRisque,
  determinerPriorite
};