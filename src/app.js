const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./config/env');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');

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
    ? ['https://votre-domaine.com', 'https://www.votre-domaine.com'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ==========================================
// Middlewares de parsing
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// Logging HTTP & Compression
// ==========================================
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(compression());

// ==========================================
// Routes de test
// ==========================================
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend Forçage Bancaire',
    version: '1.0.0',
    status: 'running',
    environment: config.env,
    timestamp: new Date().toISOString(),
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
// Routes API
// ==========================================
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/demandes', require('./routes/demandeForçage.routes'));
app.use('/api/v1/admin', require('./routes/admin.routes')); // Si vous avez des routes admin
// app.use('/api/v1/documents', require('./routes/document.routes'));
// app.use('/api/v1/dashboard', require('./routes/dashboard.routes')); // Pour les dashboards

// ==========================================
// Gestion des erreurs 404
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

// ==========================================
// Middleware de gestion des erreurs
// ==========================================
app.use(errorHandler);

// ==========================================
// Gestion des erreurs non capturées
// ==========================================
process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Rejection:', err);
  // En production, vous pourriez vouloir redémarrer le serveur
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
  // En production, redémarrage sécurisé
  process.exit(1);
});

// ==========================================
// Démarrage du serveur
// ==========================================
const server = app.listen(config.port, () => {
  logger.info(`🚀 Serveur démarré sur le port ${config.port}`);
  logger.info(`📍 Environment: ${config.env}`);
  logger.info(`🔗 URL: http://localhost:${config.port}`);
  logger.info(`🗄️  Base de données: MongoDB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu. Arrêt gracieux du serveur...');
  server.close(() => {
    logger.info('Serveur arrêté.');
    process.exit(0);
  });
});

module.exports = app;