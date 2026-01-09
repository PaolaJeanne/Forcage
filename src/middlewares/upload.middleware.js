// src/middlewares/upload.middleware.js - VERSION CONSOLIDÉE
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtrer les types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Formats acceptés: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX'));
  }
};

// Configuration multer de base
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max par fichier
  },
  fileFilter: fileFilter
});

// Middleware pour gérer les erreurs Multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('Multer error', err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'Fichier trop volumineux (max 5MB)');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return errorResponse(res, 400, 'Trop de fichiers (max 5)');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return errorResponse(res, 400, 'Champ de fichier inattendu');
    }
    return errorResponse(res, 400, `Erreur upload: ${err.message}`);
  }
  
  if (err) {
    logger.error('Upload error', err);
    return errorResponse(res, 400, err.message);
  }
  
  next();
};

// Middleware pour upload multiple avec logging
const uploadMultiple = (fieldName = 'justificatifs', maxCount = 5) => {
  const multerUpload = upload.array(fieldName, maxCount);

  return (req, res, next) => {
    multerUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error', err);
        return errorResponse(res, 400, `Erreur upload: ${err.message}`);
      } else if (err) {
        logger.error('Upload error', err);
        return errorResponse(res, 400, err.message);
      }

      logger.debug('Files uploaded', { 
        count: req.files ? req.files.length : 0,
        fieldName 
      });
      next();
    });
  };
};

// Middleware pour upload simple
const uploadSingle = (fieldName = 'document') => {
  return [
    upload.single(fieldName),
    handleUploadError
  ];
};

// Middleware pour upload avec champs multiples
const uploadFields = (fields) => {
  return [
    upload.fields(fields || [
      { name: 'justificatifs', maxCount: 5 },
      { name: 'pieceIdentite', maxCount: 1 }
    ]),
    handleUploadError
  ];
};

module.exports = {
  uploadMultiple,
  uploadSingle,
  uploadFields,
  handleUploadError,
  upload // Export de base pour compatibilité
};