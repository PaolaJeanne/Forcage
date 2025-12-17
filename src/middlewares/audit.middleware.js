// src/middleware/audit.middleware.js - VERSION SIMPLIFIÉE
const { AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Extrait l'ID d'entité depuis n'importe quelle source
 */
const extractEntityId = (req, data) => {
  // 1. D'abord vérifier la réponse (pour les POST - créations)
  if (data) {
    if (data.data && data.data._id) return data.data._id;
    if (data._id) return data._id;
    if (data.id) return data.id;
  }
  
  // 2. Ensuite vérifier les paramètres de la requête
  // Tous les paramètres potentiels
  const allParams = {
    ...req.params,
    ...(req.body || {}),
    ...(req.query || {})
  };
  
  // Chercher n'importe quel champ qui pourrait être un ID
  const idFields = ['id', '_id', 'demandeId', 'userId', 'documentId', 'clientId', 'entiteId'];
  
  for (const field of idFields) {
    if (allParams[field]) {
      return allParams[field];
    }
  }
  
  // 3. Chercher dans le body de manière plus large
  if (req.body) {
    // Chercher n'importe quel champ qui finit par 'Id' ou '_id'
    for (const key in req.body) {
      if (key.toLowerCase().endsWith('id') || key === '_id') {
        return req.body[key];
      }
    }
  }
  
  return null;
};

/**
 * Middleware audit simplifié
 */
const auditLogger = (action, entite) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Une seule ligne pour tout extraire
        const entiteId = extractEntityId(req, data);
        
        createAuditLog({
          utilisateur: req.user?.id || req.user?._id || null,
          action: action,
          entite: entite,
          entiteId: entiteId,
          details: {
            method: req.method,
            path: req.path,
            body: sanitizeBody(req.body),
            query: req.query,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString(),
            // Debug: d'où vient l'ID
            idSource: entiteId ? findIdSource(req, data, entiteId) : 'not_found'
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }).catch(err => {
          logger.error('Erreur audit:', err.message);
        });
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Trouve la source de l'ID (pour debug)
 */
const findIdSource = (req, data, entiteId) => {
  // Chercher partout !
  const sources = [
    { name: 'data.data._id', value: data?.data?._id },
    { name: 'data._id', value: data?._id },
    { name: 'data.id', value: data?.id },
    { name: 'params.id', value: req.params?.id },
    { name: 'body._id', value: req.body?._id },
    { name: 'body.id', value: req.body?.id }
  ];
  
  // Ajouter tous les paramètres
  for (const key in req.params) {
    if (key !== 'id') sources.push({ name: `params.${key}`, value: req.params[key] });
  }
  
  // Trouver la source
  for (const source of sources) {
    if (source.value && source.value.toString() === entiteId.toString()) {
      return source.name;
    }
  }
  
  return 'multiple_or_unknown';
};

/**
 * Créer un log d'audit
 */
const createAuditLog = async (data) => {
  try {
    const auditLog = new AuditLog(data);
    await auditLog.save();
    
    logger.info(`📝 ${data.action} ${data.entite} ${data.entiteId ? `(${data.entiteId})` : ''}`);
    
  } catch (error) {
    logger.error('❌ Erreur audit:', error.message);
  }
};

/**
 * Sanitize body (version simplifiée)
 */
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitivePatterns = [/password/i, /token/i, /secret/i, /key/i, /pin/i, /cvv/i];
  
  for (const key in sanitized) {
    // Vérifier si le champ est sensible
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
    
    if (isSensitive && sanitized[key]) {
      sanitized[key] = '***';
    }
    
    // Récurssion pour les objets imbriqués
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  
  return sanitized;
};

/**
 * Logger manuel simplifié
 */
const logAction = (req, action, entite, extraDetails = {}) => {
  return createAuditLog({
    utilisateur: req.user?.id || req.user?._id || null,
    action: action,
    entite: entite,
    entiteId: extractEntityId(req, null),
    details: {
      ...extraDetails,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
};

module.exports = {
  auditLogger,
  logAction,
  sanitizeBody,
  extractEntityId
};