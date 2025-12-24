// src/config/database.js   
const mongoose = require('mongoose');
const config = require('../config/env'); // Make sure the path to env.js is correct


const connectDB = async () => {
  try {
    const mongoURI = config.mongodb.uri;

    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in config');
    }

    // Remove 'useNewUrlParser' and 'useUnifiedTopology' options
    await mongoose.connect(mongoURI); // No need for options anymore

    mongoose.connection.on('error', (err) => {

    });

    mongoose.connection.on('disconnected', () => {

    });

  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
