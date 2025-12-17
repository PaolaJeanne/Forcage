
// ============================================
// 2. MIDDLEWARE UPLOAD - middlewares/upload.middleware.js
// ============================================
const multer = require('multer');
const upload = require('../config/multer.config');
const { errorResponse } = require('../utils/response.util');

// Middleware pour gérer les erreurs Multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'Fichier trop volumineux (max 5MB)');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return errorResponse(res, 400, 'Trop de fichiers (max 5)');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return errorResponse(res, 400, 'Champ de fichier inattendu. Utilisez "piecesJustificatives"');
    }
    return errorResponse(res, 400, `Erreur upload: ${err.message}`);
  }
  
  if (err) {
    return errorResponse(res, 400, err.message);
  }
  
  next();
};

// Middleware pour upload multiple
const uploadMultiple = (fieldName = 'piecesJustificatives', maxCount = 5) => {
  return [
    upload.array(fieldName, maxCount),
    handleUploadError
  ];
};

// Middleware pour upload simple
const uploadSingle = (fieldName = 'document') => {
  return [
    upload.single(fieldName),
    handleUploadError
  ];
};

module.exports = {
  uploadMultiple,
  uploadSingle,
  handleUploadError
};
