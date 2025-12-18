// src/services/pdf.service.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  
  static async generateReportPDF(report, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);
        
        doc.pipe(stream);
        
        // En-tête
        doc.fontSize(20).text('Rapport des Demandes de Forçage', { align: 'center' });
        doc.moveDown();
        
        // Informations du rapport
        doc.fontSize(12).text(`Titre: ${report.titre}`);
        doc.text(`Période: ${new Date(report.periode.dateDebut).toLocaleDateString()} - ${new Date(report.periode.dateFin).toLocaleDateString()}`);
        doc.text(`Généré le: ${new Date(report.createdAt).toLocaleDateString()}`);
        doc.moveDown();
        
        // Résumé exécutif
        doc.fontSize(14).text('Résumé Exécutif', { underline: true });
        doc.moveDown();
        
        if (report.donnees.kpis) {
          doc.fontSize(12).text('Indicateurs Clés de Performance:');
          Object.entries(report.donnees.kpis).forEach(([key, value]) => {
            doc.text(`• ${this.formatKey(key)}: ${value}`);
          });
          doc.moveDown();
        }
        
        // Graphiques (si disponibles)
        if (report.donnees.charts) {
          // Ici vous pourriez ajouter des images de graphiques
          // Pour l'instant, on met juste les données
          doc.fontSize(14).text('Analyses et Tendances', { underline: true });
          doc.moveDown();
          
          // ... Ajouter les analyses
        }
        
        // Recommandations
        doc.addPage();
        doc.fontSize(14).text('Recommandations', { underline: true });
        doc.moveDown();
        
        this.addRecommendations(doc, report.donnees);
        
        // Pied de page
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8)
            .text(
              `Page ${i + 1} sur ${totalPages}`,
              doc.page.width - 100,
              doc.page.height - 30,
              { align: 'center', width: 100 }
            );
        }
        
        doc.end();
        
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  static formatKey(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
  
  static addRecommendations(doc, data) {
    const recommendations = [];
    
    // Analyse du taux de validation
    if (data.kpis?.tauxValidation < 60) {
      recommendations.push({
        title: 'Amélioration du taux de validation',
        description: `Le taux de validation actuel (${data.kpis.tauxValidation}%) est inférieur à l\'objectif de 60%.`,
        actions: [
          'Former les conseillers sur les critères d\'acceptation',
          'Revoir les processus de validation',
          'Analyser les causes des refus'
        ]
      });
    }
    
    // Gestion du risque
    if (data.stats?.demandesParRisque) {
      const risqueCritique = data.stats.demandesParRisque.find(d => d._id === 'CRITIQUE');
      if (risqueCritique && risqueCritique.count > 5) {
        recommendations.push({
          title: 'Attention aux risques critiques',
          description: `${risqueCritique.count} demandes présentent un risque critique.`,
          actions: [
            'Renforcer les contrôles sur ces dossiers',
            'Mettre en place un comité de risque',
            'Revoir les politiques de crédit'
          ]
        });
      }
    }
    
    // Ajouter les recommandations au PDF
    recommendations.forEach((rec, index) => {
      doc.fontSize(12).text(`${index + 1}. ${rec.title}`, { underline: true });
      doc.fontSize(10).text(rec.description);
      doc.moveDown(0.5);
      rec.actions.forEach(action => {
        doc.fontSize(10).text(`   • ${action}`);
      });
      doc.moveDown();
    });
  }
}

module.exports = PDFService;