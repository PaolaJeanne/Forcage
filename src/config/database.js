const mongoose = require('mongoose');
const config = require('../config/env'); // Make sure the path to env.js is correct
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = config.mongodb.uri;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in config');
    }

    // Remove 'useNewUrlParser' and 'useUnifiedTopology' options
    await mongoose.connect(mongoURI); // No need for options anymore
    
    logger.info('✅ MongoDB connecté avec succès');

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Erreur MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB déconnecté');
    });

  } catch (error) {
    logger.error('❌ Erreur de connexion MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
// src/config/database.js   