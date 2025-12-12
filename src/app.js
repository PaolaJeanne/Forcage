const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');
const demandeForçageRoutes = require('./routes/demandeForçage.routes');


const app = express();

// ==========================================
// Connexion à MongoDB
// ==========================================
connectDB();

// ==========================================
// Middlewares de Sécurité
// ==========================================
app.use(helmet());
app.use(cors({
  origin: config.env === 'production' 
    ? ['https://votre-domaine.com'] 
    : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, veuillez réessayer plus tard.'
});
app.use('/api/', limiter);

// ==========================================
// Middlewares de parsing
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// Routes de test
// ==========================================
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend Forçage Bancaire',
    version: '1.0.0',
    status: 'running',
    database: 'MongoDB'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend Forçage Bancaire opérationnel',
    timestamp: new Date().toISOString(),
    environment: config.env,
    database: 'connected'
  });
});

// ==========================================
// Routes API (à venir)
// ==========================================
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/demandes', require('./routes/demandeForçage.routes'));
// app.use('/api/v1/documents', require('./routes/document.routes'));


// ==========================================
// Gestion des erreurs 404
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// ==========================================
// Middleware de gestion des erreurs
// ==========================================
app.use(errorHandler);

// ==========================================
// Démarrage du serveur
// ==========================================
app.listen(config.port, () => {
  logger.info(`🚀 Serveur démarré sur le port ${config.port}`);
  logger.info(`📍 Environment: ${config.env}`);
  logger.info(`🔗 URL: http://localhost:${config.port}`);
  logger.info(`🗄️  Base de données: MongoDB`);
});

module.exports = app;