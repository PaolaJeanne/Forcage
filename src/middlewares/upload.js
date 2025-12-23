// middlewares/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Configuration multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max par fichier
  },
  fileFilter: fileFilter
});

// ✅ MIDDLEWARE PERSONNALISÉ QUI PARSE CORRECTEMENT
const uploadMultiple = (req, res, next) => {
  const multerUpload = upload.array('justificatifs', 5);

  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {

      return res.status(400).json({
        success: false,
        message: `Erreur upload: ${err.message}`,
        code: err.code
      });
    } else if (err) {

      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // 🔍 Debug - Voir ce qui a été parsé


    next();
  });
};

module.exports = {
  uploadSingle: upload.single('document'),
  uploadMultiple: uploadMultiple,  // ✅ Version qui log
  uploadFields: upload.fields([
    { name: 'justificatifs', maxCount: 5 },
    { name: 'pieceIdentite', maxCount: 1 }
  ]),
  upload
};