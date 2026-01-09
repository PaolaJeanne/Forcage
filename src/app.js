// app.js - VERSION CORRIGÉE AVEC SCHEDULER ET CHARGEMENT DE ROUTES FONCTIONNEL
const logger = require('./utils/logger.util');

logger.info('Démarrage du script app.js');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

logger.info('Modules natifs chargés');

let config;
try {
  config = require('./config/env');
  logger.info(`Configuration chargée (env: ${config.env}, port: ${config.port})`);
} catch (error) {
  logger.error('Impossible de charger ./config/env', error);
  process.exit(1);
}

const { errorHandler, notFound } = require('./middlewares/errorHandler');
const connectDB = require('./config/database');
const SchedulerService = require('./services/SchedulerService');

// ⚠️ NE PAS IMPORTER LES ROUTES ICI - Elles seront chargées dynamiquement plus bas

const app = express();
const server = http.createServer(app);

// ==========================================
// Configuration WebSocket
// ==========================================
logger.info('Configuration WebSocket');
const io = socketIo(server, {
  cors: {
    origin: config.env === 'production'
      ? ['https://votre-domaine.com', 'https://www.votre-domaine.com']
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  transports: ['websocket', 'polling']
});

// Stocker l'instance io globalement pour les services
global.io = io;

// ==========================================
// Fonction de démarrage principale
// ==========================================
async function startServer() {
  try {
    logger.info('Tentative de connexion MongoDB');

    // Connexion à MongoDB
    await connectDB();
    logger.success('MongoDB connecté avec succès');

    // Initialiser le scheduler
    if (process.env.ENABLE_SCHEDULER !== 'false') {
      try {
        logger.info('Initialisation du SchedulerService');
        await SchedulerService.initialize();
        logger.success('Scheduler initialisé');
      } catch (error) {
        logger.error('Initialisation du scheduler', error);
        // Ne pas arrêter le serveur si le scheduler échoue
      }
    } else {
      logger.info('Scheduler désactivé (ENABLE_SCHEDULER=false)');
    }

    // Initialiser les templates de notifications
    try {
      logger.info('Initialisation templates notifications');
      const NotificationTemplateService = require('./services/notificationTemplate.service');
      await NotificationTemplateService.initialiserTemplatesParDefaut();
      logger.success('Templates notifications OK');
    } catch (error) {
      logger.error('Initialisation templates notifications', error);
    }

    // Configurer les hooks de notifications
    try {
      logger.info('Configuration hooks notifications');
      const { setupDemandeHooks } = require('./hooks/notification.hooks');
      const DemandeForçage = require('./models/DemandeForçage');

      setupDemandeHooks(DemandeForçage);
      logger.success('Hooks notifications OK');
    } catch (error) {
      logger.error('Configuration hooks notifications', error);
    }

    // Démarrage serveur
    const PORT = config.port || 5000;

    server.listen(PORT, '0.0.0.0', () => {
      logger.header('SERVER RUNNING', '🚀');
      logger.info(`Port: ${PORT}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API URL: http://localhost:${PORT}`);
      logger.info(`Scheduler: ${process.env.ENABLE_SCHEDULER !== 'false' ? 'ACTIF' : 'INACTIF'}`);
      logger.footer();
    });

  } catch (error) {
    logger.error('Erreur démarrage', error);
    process.exit(1);
  }
}

// ==========================================
// Middlewares de Sécurité
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173'
    ];

    // En développement, autoriser aussi les IPs locales (192.168.x.x)
    const isLocalNetwork = /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin);

    if (config.env === 'production') {
      const prodOrigins = ['https://votre-domaine.com', 'https://www.votre-domaine.com'];
      if (prodOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // En dev : localhost OU réseau local
      if (allowedOrigins.indexOf(origin) !== -1 || isLocalNetwork) {
        callback(null, true);
      } else {
        console.warn('⚠️ Origin blocké par CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// Request Logging Middleware
// ==========================================
app.use((req, res, next) => {
  logger.request(req.method, req.path, req.user);
  logger.debug('Authorization', req.headers.authorization ? '✅ Present' : '❌ Missing');
  next();
});

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
// WebSocket Initialisation
// ==========================================
io.on('connection', (socket) => {
  logger.info(`Nouvelle connexion WebSocket: ${socket.id}`);

  // Joindre la salle utilisateur si authentifié
  socket.on('authenticate', (userId) => {
    if (userId) {
      logger.debug(`Socket authentifié UserID: ${userId}`);
      socket.join(`user:${userId}`);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info(`WebSocket disconnect: ${socket.id} (raison: ${reason})`);
  });
});

// ==========================================
// TEST SIMPLE POUR DÉMARRER
// ==========================================
app.get('/api/test', (req, res) => {
  logger.debug('Appel GET /api/test');
  res.json({
    success: true,
    message: 'API fonctionnelle',
    timestamp: new Date().toISOString(),
    scheduler: process.env.ENABLE_SCHEDULER !== 'false' ? 'actif' : 'inactif',
    endpoints: {
      demandes: '/api/v1/demandes',
      auth: '/api/v1/auth',
      health: '/health'
    }
  });
});

// ==========================================
// DEBUG ENDPOINT - Token Test
// ==========================================
app.get('/api/debug/token-test', (req, res) => {
  const authHeader = req.headers.authorization;
  logger.header('DEBUG TOKEN TEST', '🔍');
  logger.debug('Authorization Header', authHeader ? '✅ Present' : '❌ Missing');
  if (authHeader) {
    logger.debug('Header Value', authHeader.substring(0, 50) + '...');
  }
  logger.footer();

  res.json({
    success: true,
    message: 'Token test endpoint',
    authHeaderPresent: !!authHeader,
    authHeaderValue: authHeader ? authHeader.substring(0, 50) + '...' : null,
    headers: req.headers
  });
});

// ==========================================
// Servir les fichiers statiques
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ==========================================
// Routes de base
// ==========================================
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend Forçage Bancaire',
    version: '2.0.0',
    status: 'running',
    environment: config.env,
    scheduler: process.env.ENABLE_SCHEDULER !== 'false' ? 'actif' : 'inactif',
    timestamp: new Date().toISOString(),
    endpoints: {
      test: '/api/test',
      health: '/health',
      api_docs: '/api-docs'
    }
  });
});

app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'OK',
    message: 'Backend Forçage Bancaire opérationnel',
    timestamp: new Date().toISOString(),
    environment: config.env,
    database: dbStatus,
    websocket: io.engine.clientsCount > 0 ? 'active' : 'idle',
    scheduler: process.env.ENABLE_SCHEDULER !== 'false' ? 'actif' : 'inactif'
  });
});

// ==========================================
// Routes API
// ==========================================
const apiRoutes = require('./routes/api.routes');
app.use('/api/v1', apiRoutes);


// ==========================================
// Routes API WebSocket
// ==========================================
setTimeout(() => {
  try {
    logger.info('Chargement sockets additionnels');

    // WebSocket pour les notifications
    const notificationSocketPath = path.join(__dirname, 'websocket/notification.socket.js');
    if (fs.existsSync(notificationSocketPath)) {
      const notificationSocket = require(notificationSocketPath);
      notificationSocket(io);
      logger.success('Notification Socket chargé');
    }

    // WebSocket pour le chat
    const chatSocketPath = path.join(__dirname, 'websocket/chat.socket.js');
    if (fs.existsSync(chatSocketPath)) {
      const chatSocket = require(chatSocketPath);
      chatSocket(io);
      logger.success('Chat Socket chargé');
    }
  } catch (error) {
    logger.error('Chargement sockets', error);
  }
}, 1000);

// ==========================================
// Gestion des erreurs 404 & Erreurs globales
// ==========================================
app.use(notFound);
app.use(errorHandler);

// ==========================================
// Gestion des erreurs non capturées
// ==========================================
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION', err);
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION', err);
  process.exit(1);
});

// ==========================================
// Lancement du serveur
// ==========================================
startServer().catch(error => {
  logger.error('Échec du démarrage du serveur', error);
  process.exit(1);
});

// ==========================================
// Graceful shutdown
// ==========================================
const shutdown = async (signal) => {
  logger.info(`Signal ${signal} received. Closing server...`);

  // Arrêter le scheduler si actif
  if (process.env.ENABLE_SCHEDULER !== 'false' && SchedulerService) {
    try {
      logger.info('Arrêt du scheduler');
      await SchedulerService.shutdown();
      logger.success('Scheduler arrêté');
    } catch (error) {
      logger.error('Arrêt du scheduler', error);
    }
  }

  // Fermer les connexions WebSocket
  io.close(() => {
    logger.success('WebSockets closed');
  });

  // Fermer le serveur HTTP
  server.close(() => {
    logger.success('HTTP server closed');

    // Fermer la connexion MongoDB
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      logger.success('MongoDB connection closed');
      process.exit(0);
    });
  });

  // Timeout forcé après 10 secondes
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };