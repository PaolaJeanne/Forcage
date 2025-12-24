
// ============================================
// src/controllers/export.controller.js
// ============================================
const PDFService = require('../services/pdf.service');

class ExportController {
  
  // Exporter une demande en PDF
  async exporterDemande(req, res) {
    try {
      const { id } = req.params;
      
      const pdfBuffer = await PDFService.genererRapportDemande(id);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=demande-${id}.pdf`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('❌ Erreur export demande:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Exporter les statistiques en PDF
  async exporterStatistiques(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        agence: req.query.agence,
        conseillerId: req.query.conseillerId
      };
      
      const pdfBuffer = await PDFService.genererRapportStatistiques(filters);
      
      const filename = `rapport-stats-${Date.now()}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('❌ Erreur export stats:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ExportController();

