
// ============================================
// src/services/pdf.service.js
// ============================================
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const DemandeForçage = require('../models/DemandeForçage');

class PDFService {

  /**
   * Générer un rapport de demande
   */
  static async genererRapportDemande(demandeId) {
    const demande = await DemandeForçage.findById(demandeId)
      .populate('clientId', 'nom prenom email numeroCompte')
      .populate('conseillerId', 'nom prenom email')
      .populate('validePar_rm.userId', 'nom prenom')
      .populate('validePar_dce.userId', 'nom prenom')
      .populate('validePar_adg.userId', 'nom prenom');

    if (!demande) {
      throw new Error('Demande non trouvée');
    }

    return new Promise((resolve, reject) => {
      try {
        // Créer le document PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Stream vers buffer
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // ========== EN-TÊTE ==========
        this.ajouterEnTete(doc, 'RAPPORT DE DEMANDE DE FORÇAGE');

        // ========== INFORMATIONS GÉNÉRALES ==========
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('INFORMATIONS GÉNÉRALES', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#000');
        this.ajouterLigne(doc, 'Numéro de référence', demande.numeroReference);
        this.ajouterLigne(doc, 'Date de création', this.formatDate(demande.dateCreation));
        this.ajouterLigne(doc, 'Statut actuel', demande.statut);
        this.ajouterLigne(doc, 'Priorité', demande.priorite);
        this.ajouterLigne(doc, 'Type d\'opération', demande.typeOperation);

        // ========== CLIENT ==========
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('INFORMATIONS CLIENT', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#000');
        this.ajouterLigne(doc, 'Nom', `${demande.clientId.prenom} ${demande.clientId.nom}`);
        this.ajouterLigne(doc, 'Email', demande.clientId.email);
        this.ajouterLigne(doc, 'Numéro de compte', demande.clientId.numeroCompte || 'N/A');
        this.ajouterLigne(doc, 'Notation', demande.notationClient);

        // ========== DÉTAILS FINANCIERS ==========
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('DÉTAILS FINANCIERS', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#000');
        this.ajouterLigne(doc, 'Montant demandé', this.formatMontant(demande.montant));
        this.ajouterLigne(doc, 'Solde actuel', this.formatMontant(demande.soldeActuel));
        this.ajouterLigne(doc, 'Découvert autorisé', this.formatMontant(demande.decouvertAutorise));
        this.ajouterLigne(doc, 'Montant du forçage', this.formatMontant(demande.montantForçageTotal));

        if (demande.montantAutorise) {
          this.ajouterLigne(doc, 'Montant autorisé', this.formatMontant(demande.montantAutorise));
        }

        this.ajouterLigne(doc, 'Date d\'échéance', this.formatDate(demande.dateEcheance));

        // ========== MOTIF ==========
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('MOTIF DE LA DEMANDE', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#000');
        doc.text(demande.motif, { align: 'justify' });

        // ========== WORKFLOW ==========
        if (demande.historique && demande.historique.length > 0) {
          doc.addPage();
          doc.fontSize(14).fillColor('#1a56db').text('HISTORIQUE DU WORKFLOW', { underline: true });
          doc.moveDown(0.5);

          demande.historique.forEach((etape, index) => {
            doc.fontSize(10).fillColor('#000');
            doc.text(`${index + 1}. ${etape.action}`, { continued: true });
            doc.fillColor('#666').text(` - ${this.formatDate(etape.timestamp)}`);

            if (etape.commentaire) {
              doc.fillColor('#333').text(`   "${etape.commentaire}"`, { indent: 20 });
            }

            doc.moveDown(0.3);
          });
        }

        // ========== VALIDATIONS ==========
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('VALIDATIONS', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#000');

        if (demande.conseillerId) {
          this.ajouterLigne(doc, 'Conseiller assigné',
            `${demande.conseillerId.prenom} ${demande.conseillerId.nom}`
          );
        }

        if (demande.validePar_rm?.userId) {
          this.ajouterLigne(doc, 'Validé par RM',
            `${demande.validePar_rm.userId.prenom} ${demande.validePar_rm.userId.nom} - ${this.formatDate(demande.validePar_rm.date)}`
          );
        }

        if (demande.validePar_dce?.userId) {
          this.ajouterLigne(doc, 'Validé par DCE',
            `${demande.validePar_dce.userId.prenom} ${demande.validePar_dce.userId.nom} - ${this.formatDate(demande.validePar_dce.date)}`
          );
        }

        if (demande.validePar_adg?.userId) {
          this.ajouterLigne(doc, 'Validé par ADG',
            `${demande.validePar_adg.userId.prenom} ${demande.validePar_adg.userId.nom} - ${this.formatDate(demande.validePar_adg.date)}`
          );
        }

        // ========== PIED DE PAGE ==========
        this.ajouterPiedDePage(doc);

        // Finaliser le PDF
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Générer un rapport statistique
   */
  static async genererRapportStatistiques(filters = {}) {
    const AnalyticsService = require('./analytics.service');

    const [overview, distribution, evolution] = await Promise.all([
      AnalyticsService.getOverview(filters),
      AnalyticsService.getStatutDistribution(filters),
      AnalyticsService.getEvolutionTemporelle(filters)
    ]);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // EN-TÊTE
        this.ajouterEnTete(doc, 'RAPPORT STATISTIQUES');

        // PÉRIODE
        doc.moveDown();
        doc.fontSize(12).fillColor('#666');
        doc.text(`Période: ${overview.periode.debut} - ${overview.periode.fin}`);

        // KPIs
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('INDICATEURS CLÉS', { underline: true });
        doc.moveDown(0.5);

        const kpis = overview.kpis;

        doc.fontSize(10).fillColor('#000');
        this.ajouterLigne(doc, 'Total demandes', kpis.totalDemandes.toString());
        this.ajouterLigne(doc, 'En attente', kpis.enAttente.toString());
        this.ajouterLigne(doc, 'Approuvées', `${kpis.approuvees} (${kpis.tauxApprobation}%)`);
        this.ajouterLigne(doc, 'Rejetées', `${kpis.rejetees} (${kpis.tauxRejet}%)`);
        this.ajouterLigne(doc, 'Montant total', this.formatMontant(kpis.montantTotal));
        this.ajouterLigne(doc, 'Montant moyen', this.formatMontant(kpis.montantMoyen));
        this.ajouterLigne(doc, 'Délai moyen', `${kpis.delaiMoyenJours} jours`);

        // DISTRIBUTION PAR STATUT
        doc.moveDown();
        doc.fontSize(14).fillColor('#1a56db').text('DISTRIBUTION PAR STATUT', { underline: true });
        doc.moveDown(0.5);

        distribution.forEach(item => {
          doc.fontSize(10).fillColor('#000');
          doc.text(`${item.label}: ${item.count} demandes (${this.formatMontant(item.montantTotal)})`);
        });

        // PIED DE PAGE
        this.ajouterPiedDePage(doc);

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  // ========== HELPERS ==========

  static ajouterEnTete(doc, titre) {
    doc.fontSize(20).fillColor('#1a56db').text(titre, { align: 'center' });
    doc.moveDown();
    doc.strokeColor('#1a56db').lineWidth(2)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  static ajouterLigne(doc, label, valeur) {
    doc.fontSize(10);
    doc.fillColor('#666').text(label + ':', { continued: true, width: 200 });
    doc.fillColor('#000').text(valeur, { width: 300 });
  }

  static ajouterPiedDePage(doc) {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 1; i <= pageCount; i++) {
      doc.switchToPage(i - 1); // PDFKit uses 0-based internal indexing

      doc.fontSize(8).fillColor('#999');
      doc.text(
        `Page ${i} sur ${pageCount} - Généré le ${this.formatDate(new Date())}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
    }
  }

  static formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static formatMontant(montant) {
    if (!montant) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(montant);
  }
}

module.exports = PDFService;

