// app.js - VERSION CORRIGÉE AVEC CHARGEMENT DE ROUTES FONCTIONNEL
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

const config = require('./config/env');

const { errorHandler, notFound } = require('./middlewares/errorHandler');
const connectDB = require('./config/database');
const workflowRoutes = require('./routes/workflow.routes');


const app = express();
const server = http.createServer(app);



// ==========================================
// Configuration WebSocket
// ==========================================
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
// Connexion à MongoDB
// ==========================================
connectDB().then(async () => {


  // Initialiser les templates de notifications
  try {
    const NotificationTemplateService = require('./services/notificationTemplate.service');
    await NotificationTemplateService.initialiserTemplatesParDefaut();


  } catch (error) { }

  // Configurer les hooks de notifications
  try {
    const { setupDemandeHooks } = require('./hooks/notification.hooks');
    const DemandeForçage = require('./models/DemandeForçage');

    setupDemandeHooks(DemandeForçage);
  } catch (error) { }
}).catch(err => {

  process.exit(1);
});

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
  app.use(morgan('combined', {
    stream: {

    }
  }));
}

app.use(compression());

// ==========================================
// WebSocket Initialisation
// ==========================================
io.on('connection', (socket) => {


  // Joindre la salle utilisateur si authentifié
  socket.on('authenticate', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);

    }
  });

  socket.on('disconnect', (reason) => {

  });
});

// ==========================================
// TEST SIMPLE POUR DÉMARRER
// ==========================================
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API fonctionnelle',
    timestamp: new Date().toISOString(),
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
    websocket: io.engine.clientsCount > 0 ? 'active' : 'idle'
  });
});

// ==========================================
// Routes API - CHARGEMENT CORRIGÉ
// ==========================================


// Fonction pour charger une route avec gestion d'erreur améliorée
function loadRoute(routePath, routeName, mountPath) {
  try {
    const fullPath = path.join(__dirname, routePath);

    // Vérifier si le fichier existe
    if (fs.existsSync(fullPath + '.js')) {

      const routeModule = require(fullPath);

      if (routeModule && typeof routeModule === 'function') {
        app.use(mountPath, routeModule);

        return true;
      } else if (routeModule && routeModule.router) {
        app.use(mountPath, routeModule.router || routeModule);

        return true;
      } else {

        return false;
      }
    } else if (fs.existsSync(fullPath + '/index.js')) {

      const routeModule = require(fullPath);

      if (routeModule && typeof routeModule === 'function') {
        app.use(mountPath, routeModule);

        return true;
      } else {

        return false;
      }
    } else {

      return false;
    }
  } catch (error) {

    return false;
  }
}

// Liste des routes à charger avec leurs chemins
const routesToLoad = [
  { path: './routes/auth.routes', name: 'Authentification', mount: '/api/v1/auth' },
  { path: './routes/demandeForçage.routes', name: 'Demandes', mount: '/api/v1/demandes' },
  { path: './routes/admin.routes', name: 'Administration', mount: '/api/v1/admin' },
  { path: './routes/notification.routes', name: 'Notifications', mount: '/api/v1/notifications' },
  { path: './routes/dashboard.routes', name: 'Dashboard', mount: '/api/v1/dashboard' },
  { path: './routes/workflow.routes', name: 'Workflow', mount: '/api/v1/demandes' }
];

// Routes optionnelles (ne bloquent pas le démarrage)
const optionalRoutes = [
  { path: './routes/document.routes', name: 'Documents', mount: '/api/v1/documents' },
  { path: './routes/audit.routes', name: 'Audit', mount: '/api/v1/audit' },
  { path: './routes/chat.routes', name: 'Chat', mount: '/api/v1/chat' }
];


let loadedRoutes = 0;

routesToLoad.forEach(route => {
  if (loadRoute(route.path, route.name, route.mount)) {
    loadedRoutes++;
  }
});


optionalRoutes.forEach(route => {
  try {
    loadRoute(route.path, route.name, route.mount);
  } catch (error) {

  }
});



// ==========================================
// Routes API WebSocket
// ==========================================
setTimeout(() => {
  try {
    // WebSocket pour les notifications
    const notificationSocketPath = path.join(__dirname, 'websocket/notification.socket.js');
    if (fs.existsSync(notificationSocketPath)) {
      const notificationSocket = require(notificationSocketPath);
      notificationSocket(io);
    }


    // WebSocket pour le chat
    const chatSocketPath = path.join(__dirname, 'websocket/chat.socket.js');
    if (fs.existsSync(chatSocketPath)) {
      const chatSocket = require(chatSocketPath);
      chatSocket(io);
    }
  } catch (error) {

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

});

process.on('uncaughtException', (err) => {

  process.exit(1);
});

// ==========================================
// Démarrage du serveur
// ==========================================
const PORT = config.port || 5000;

server.listen(PORT, '0.0.0.0', () => {



});

// ==========================================
// Graceful shutdown
// ==========================================
const shutdown = (signal) => {


  // Fermer les connexions WebSocket
  io.close(() => {

  });

  // Fermer le serveur HTTP
  server.close(() => {


    // Fermer la connexion MongoDB
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {

      process.exit(0);
    });
  });

  // Timeout forcé après 10 secondes
  setTimeout(() => {

    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };