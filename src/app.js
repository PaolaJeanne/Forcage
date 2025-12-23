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
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const connectDB = require('./config/database');

const app = express();
const server = http.createServer(app);

// ==========================================
// Vérification des chemins de fichiers
// ==========================================
console.log('📁 Dossier courant:', __dirname);
console.log('📁 Contenu du dossier routes:');

try {
  const routesDir = path.join(__dirname, 'routes');
  if (fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir);
    console.log('Fichiers trouvés dans routes/:', files.map(f => `- ${f}`).join('\n'));
  } else {
    console.log('❌ Dossier routes/ non trouvé, création...');
    fs.mkdirSync(routesDir, { recursive: true });
  }
} catch (error) {
  console.log('❌ Erreur vérification dossier routes:', error.message);
}

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
  logger.info('✅ Base de données connectée');
  
  // Initialiser les templates de notifications
  try {
    const NotificationTemplateService = require('./services/notificationTemplate.service');
    await NotificationTemplateService.initialiserTemplatesParDefaut();
    logger.info('✅ Templates de notifications initialisés');
  } catch (error) {
    logger.warn('⚠️ Templates de notifications non initialisés:', error.message);
  }
  
  // Configurer les hooks de notifications
  try {
    const { setupDemandeHooks } = require('./hooks/notification.hooks');
    const DemandeForçage = require('./models/DemandeForçage');
    
    setupDemandeHooks(DemandeForçage);
    logger.info('✅ Hooks de notifications configurés');
  } catch (error) {
    logger.warn('⚠️ Hooks de notifications non configurés:', error.message);
  }
}).catch(err => {
  logger.error('❌ Erreur connexion base de données:', err);
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
      write: message => logger.info(message.trim())
    }
  }));
}

app.use(compression());

// ==========================================
// WebSocket Initialisation
// ==========================================
io.on('connection', (socket) => {
  logger.info(`🔗 Nouvelle connexion Socket.IO: ${socket.id}`);
  
  // Joindre la salle utilisateur si authentifié
  socket.on('authenticate', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info(`👤 Utilisateur ${userId} connecté via WebSocket`);
    }
  });
  
  socket.on('disconnect', (reason) => {
    logger.info(`🔗 Déconnexion Socket.IO: ${socket.id}, raison: ${reason}`);
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
console.log('\n📁 Chargement des routes...');

// Fonction pour charger une route avec gestion d'erreur améliorée
function loadRoute(routePath, routeName, mountPath) {
  try {
    const fullPath = path.join(__dirname, routePath);
    
    // Vérifier si le fichier existe
    if (fs.existsSync(fullPath + '.js')) {
      console.log(`🔍 Tentative chargement: ${routePath}.js`);
      const routeModule = require(fullPath);
      
      if (routeModule && typeof routeModule === 'function') {
        app.use(mountPath, routeModule);
        console.log(`✅ Route montée: ${routeName} -> ${mountPath}`);
        return true;
      } else if (routeModule && routeModule.router) {
        app.use(mountPath, routeModule.router || routeModule);
        console.log(`✅ Route (router) montée: ${routeName} -> ${mountPath}`);
        return true;
      } else {
        console.log(`⚠️ Route ${routeName} non valide (pas un routeur Express)`);
        return false;
      }
    } else if (fs.existsSync(fullPath + '/index.js')) {
      console.log(`🔍 Tentative chargement: ${routePath}/index.js`);
      const routeModule = require(fullPath);
      
      if (routeModule && typeof routeModule === 'function') {
        app.use(mountPath, routeModule);
        console.log(`✅ Route montée: ${routeName} -> ${mountPath}`);
        return true;
      } else {
        console.log(`⚠️ Route ${routeName} non valide`);
        return false;
      }
    } else {
      console.log(`❌ Route non trouvée: ${routePath}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Erreur chargement route ${routeName}:`, error.message);
    return false;
  }
}

// Liste des routes à charger avec leurs chemins
const routesToLoad = [
  { path: './routes/auth.routes', name: 'Authentification', mount: '/api/v1/auth' },
  { path: './routes/demandeForçage.routes', name: 'Demandes', mount: '/api/v1/demandes' },
  { path: './routes/admin.routes', name: 'Administration', mount: '/api/v1/admin' },
  { path: './routes/notification.routes', name: 'Notifications', mount: '/api/v1/notifications' },
  { path: './routes/dashboard.routes', name: 'Dashboard', mount: '/api/v1/dashboard' }
];

// Routes optionnelles (ne bloquent pas le démarrage)
const optionalRoutes = [
  { path: './routes/document.routes', name: 'Documents', mount: '/api/v1/documents' },
  { path: './routes/audit.routes', name: 'Audit', mount: '/api/v1/audit' },
  { path: './routes/chat.routes', name: 'Chat', mount: '/api/v1/chat' }
];

console.log('\n📡 Chargement des routes principales:');
let loadedRoutes = 0;

routesToLoad.forEach(route => {
  if (loadRoute(route.path, route.name, route.mount)) {
    loadedRoutes++;
  }
});

console.log('\n📡 Chargement des routes optionnelles:');
optionalRoutes.forEach(route => {
  try {
    loadRoute(route.path, route.name, route.mount);
  } catch (error) {
    console.log(`⚠️ Route optionnelle non chargée: ${route.name}`);
  }
});

console.log(`\n✅ Routes chargées: ${loadedRoutes}/${routesToLoad.length}`);

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
      logger.info('🔔 WebSocket notifications activé');
    } else {
      logger.warn('⚠️ WebSocket notifications non trouvé');
    }

    // WebSocket pour le chat
    const chatSocketPath = path.join(__dirname, 'websocket/chat.socket.js');
    if (fs.existsSync(chatSocketPath)) {
      const chatSocket = require(chatSocketPath);
      chatSocket(io);
      logger.info('💬 WebSocket chat activé');
    } else {
      logger.warn('⚠️ WebSocket chat non trouvé');
    }
  } catch (error) {
    logger.warn('⚠️ Erreur initialisation WebSocket:', error.message);
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
  logger.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// ==========================================
// Démarrage du serveur
// ==========================================
const PORT = config.port || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 ========================================
   Serveur démarré avec succès !
📍 Port: ${PORT}
🌍 Environnement: ${config.env}
📅 Date: ${new Date().toLocaleString()}
🔗 URL API: http://localhost:${PORT}
🔗 URL WebSocket: ws://localhost:${PORT}
📡 Routes chargées: ${loadedRoutes}/${routesToLoad.length}
========================================
  `);
  
  logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
  logger.info(`📍 Environment: ${config.env}`);
  logger.info(`🔗 API: http://localhost:${PORT}`);
  logger.info(`🔗 WebSocket: ws://localhost:${PORT}`);
});

// ==========================================
// Graceful shutdown
// ==========================================
const shutdown = (signal) => {
  logger.info(`${signal} reçu. Arrêt gracieux du serveur...`);
  
  // Fermer les connexions WebSocket
  io.close(() => {
    logger.info('🔌 WebSocket fermé');
  });
  
  // Fermer le serveur HTTP
  server.close(() => {
    logger.info('🛑 Serveur HTTP fermé');
    
    // Fermer la connexion MongoDB
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      logger.info('🗄️  Connexion MongoDB fermée');
      process.exit(0);
    });
  });
  
  // Timeout forcé après 10 secondes
  setTimeout(() => {
    logger.error('❌ Timeout graceful shutdown, arrêt forcé');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };