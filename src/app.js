// app.js - VERSION CORRIGÉE AVEC SCHEDULER ET CHARGEMENT DE ROUTES FONCTIONNEL
console.log('>>> [DEBUG] Démarrage du script app.js...');

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

console.log('>>> [DEBUG] Modules natifs chargés.');

let config;
try {
  config = require('./config/env');
  console.log('>>> [DEBUG] Configuration chargée (env:', config.env, ', port:', config.port, ')');
} catch (error) {
  console.error('!!! [ERREUR CRITIQUE] Impossible de charger ./config/env :', error);
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
console.log('>>> [DEBUG] Configuration WebSocket...');
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
    console.log('>>> [DEBUG] Tentative de connexion MongoDB...');

    // Connexion à MongoDB
    await connectDB();
    console.log('>>> [DEBUG] MongoDB connecté avec succès.');

    // Initialiser le scheduler
    if (process.env.ENABLE_SCHEDULER !== 'false') {
      try {
        console.log('>>> [DEBUG] Initialisation du SchedulerService...');
        await SchedulerService.initialize();
        console.log('>>> [DEBUG] Scheduler initialisé.');
      } catch (error) {
        console.error('!!! [ERREUR] Initialisation du scheduler:', error);
        // Ne pas arrêter le serveur si le scheduler échoue
      }
    } else {
      console.log('>>> [DEBUG] Scheduler désactivé (ENABLE_SCHEDULER=false)');
    }

    // Initialiser les templates de notifications
    try {
      console.log('>>> [DEBUG] Initialisation templates notifications...');
      const NotificationTemplateService = require('./services/notificationTemplate.service');
      await NotificationTemplateService.initialiserTemplatesParDefaut();
      console.log('>>> [DEBUG] Templates notifications OK.');
    } catch (error) {
      console.error('!!! [ERREUR] Initialisation templates notifications :', error);
    }

    // Configurer les hooks de notifications
    try {
      console.log('>>> [DEBUG] Configuration hooks notifications...');
      const { setupDemandeHooks } = require('./hooks/notification.hooks');
      const DemandeForçage = require('./models/DemandeForçage');

      setupDemandeHooks(DemandeForçage);
      console.log('>>> [DEBUG] Hooks notifications OK.');
    } catch (error) {
      console.error('!!! [ERREUR] Configuration hooks notifications :', error);
    }

    // Démarrage serveur
    const PORT = config.port || 5000;

    server.listen(PORT, '0.0.0.0', () => {
      console.log('===================================================');
      console.log(`>>> [INFO] SERVER RUNNING ON PORT ${PORT}`);
      console.log(`>>> [INFO] Environment: ${config.env}`);
      console.log(`>>> [INFO] API URL: http://localhost:${PORT}`);
      console.log('>>> [INFO] Scheduler:', process.env.ENABLE_SCHEDULER !== 'false' ? 'ACTIF' : 'INACTIF');
      console.log('===================================================');
    });

  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
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
  console.log('>>> [DEBUG] Nouvelle connexion WebSocket:', socket.id);

  // Joindre la salle utilisateur si authentifié
  socket.on('authenticate', (userId) => {
    if (userId) {
      console.log('>>> [DEBUG] Socket authentifié UserID:', userId);
      socket.join(`user:${userId}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('>>> [DEBUG] WebSocket disconnect:', socket.id, 'raison:', reason);
  });
});

// ==========================================
// TEST SIMPLE POUR DÉMARRER
// ==========================================
app.get('/api/test', (req, res) => {
  console.log('>>> [DEBUG] Appel GET /api/test');
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
    console.log('>>> [DEBUG] Chargement sockets additionnels...');

    // WebSocket pour les notifications
    const notificationSocketPath = path.join(__dirname, 'websocket/notification.socket.js');
    if (fs.existsSync(notificationSocketPath)) {
      const notificationSocket = require(notificationSocketPath);
      notificationSocket(io);
      console.log('    ✅ Notification Socket chargé.');
    }

    // WebSocket pour le chat
    const chatSocketPath = path.join(__dirname, 'websocket/chat.socket.js');
    if (fs.existsSync(chatSocketPath)) {
      const chatSocket = require(chatSocketPath);
      chatSocket(io);
      console.log('    ✅ Chat Socket chargé.');
    }
  } catch (error) {
    console.error('!!! [ERREUR] Chargement sockets :', error);
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
  console.error('!!! [UNHANDLED REJECTION]', err);
});

process.on('uncaughtException', (err) => {
  console.error('!!! [UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});

// ==========================================
// Lancement du serveur
// ==========================================
startServer().catch(error => {
  console.error('!!! [ERREUR FATALE] Échec du démarrage du serveur:', error);
  process.exit(1);
});

// ==========================================
// Graceful shutdown
// ==========================================
const shutdown = async (signal) => {
  console.log(`>>> [INFO] Signal ${signal} received. Closing server...`);

  // Arrêter le scheduler si actif
  if (process.env.ENABLE_SCHEDULER !== 'false' && SchedulerService) {
    try {
      console.log('>>> [INFO] Arrêt du scheduler...');
      await SchedulerService.shutdown();
      console.log('>>> [INFO] Scheduler arrêté.');
    } catch (error) {
      console.error('!!! [ERREUR] Arrêt du scheduler:', error);
    }
  }

  // Fermer les connexions WebSocket
  io.close(() => {
    console.log('>>> [INFO] WebSockets closed.');
  });

  // Fermer le serveur HTTP
  server.close(() => {
    console.log('>>> [INFO] HTTP server closed.');

    // Fermer la connexion MongoDB
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      console.log('>>> [INFO] MongoDB connection closed.');
      process.exit(0);
    });
  });

  // Timeout forcé après 10 secondes
  setTimeout(() => {
    console.error('!!! [WARN] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };