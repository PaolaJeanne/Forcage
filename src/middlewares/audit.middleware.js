// src/middlewares/audit.middleware.js - SIMPLIFIÉ ET FONCTIONNEL
const mongoose = require('mongoose');

console.log('🔧 Audit middleware chargé');

const auditLogger = (action, entite) => {
  console.log(`🔧 Audit factory créée: ${action} ${entite}`);
  
  return (req, res, next) => {
    // Stocker les infos de la requête AVANT qu'elle soit modifiée
    const requestInfo = {
      method: req.method,
      path: req.path,
      user: req.user ? { id: req.user.id, email: req.user.email } : null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: req.body ? { ...req.body } : null, // Copie du body
      params: { ...req.params }
    };
    
    console.log(`🔧 [AUDIT] Préparation pour ${action} ${entite}`);
    console.log(`   User:`, requestInfo.user?.id || 'none');
    console.log(`   Body keys:`, requestInfo.body ? Object.keys(requestInfo.body) : 'none');
    
    // Intercepter la réponse
    const originalJson = res.json;
    
    res.json = function(data) {
      console.log(`🔧 [AUDIT] Interception réponse ${res.statusCode}`);
      
      // Retourner la réponse immédiatement
      const result = originalJson.call(this, data);
      
      // Traiter l'audit en arrière-plan
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setTimeout(async () => {
          try {
            console.log(`🔧 [AUDIT] Début traitement pour ${action}`);
            
            // 1. Obtenir le modèle
            let AuditLogModel;
            try {
              AuditLogModel = mongoose.model('AuditLog');
            } catch (err) {
              const schema = new mongoose.Schema({
                utilisateur: mongoose.Schema.Types.ObjectId,
                action: String,
                entite: String,
                entiteId: mongoose.Schema.Types.ObjectId,
                details: Object,
                ipAddress: String,
                userAgent: String
              }, { timestamps: true });
              AuditLogModel = mongoose.model('AuditLog', schema);
            }
            
            // 2. Préparer données
            const entiteId = requestInfo.params.id || (data?.data?._id) || null;
            
            const auditDoc = {
              utilisateur: requestInfo.user?.id || null,
              action: action,
              entite: entite,
              entiteId: entiteId,
              details: {
                method: requestInfo.method,
                path: requestInfo.path,
                statusCode: res.statusCode,
                userEmail: requestInfo.user?.email,
                timestamp: new Date().toISOString(),
                hasBody: !!requestInfo.body,
                bodyKeys: requestInfo.body ? Object.keys(requestInfo.body) : []
              },
              ipAddress: requestInfo.ip || 'unknown',
              userAgent: requestInfo.userAgent || 'unknown'
            };
            
            console.log('🔧 [AUDIT] Document prêt:', JSON.stringify(auditDoc, null, 2));
            
            // 3. Sauvegarder
            const saved = await AuditLogModel.create(auditDoc);
            console.log(`🎉 [AUDIT] SUCCÈS: ${saved._id} - ${action} ${entite}`);
            
            // 4. Vérification
            const total = await AuditLogModel.countDocuments();
            console.log(`📊 [AUDIT] Total documents: ${total}`);
            
          } catch (error) {
            console.error(`💥 [AUDIT] ÉCHEC: ${error.message}`);
            if (error.name === 'ValidationError') {
              console.error('   Erreurs:', JSON.stringify(error.errors, null, 2));
            }
          }
        }, 0);
      }
      
      return result;
    };
    
    next();
  };
};

module.exports = { auditLogger };