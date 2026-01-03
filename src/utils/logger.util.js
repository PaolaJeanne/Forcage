/**
 * Logging Utility - Centralized logging with consistent formatting
 * src/utils/logger.util.js
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class Logger {
  constructor(module = 'APP') {
    this.module = module;
    this.separator = '='.repeat(80);
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log header
   */
  header(title, emoji = '📋') {
    console.log(`\n${this.separator}`);
    console.log(`${emoji} [${this.module}] ${title}`);
    console.log(`⏰ ${this.getTimestamp()}`);
  }

  /**
   * Format log footer
   */
  footer() {
    console.log(this.separator + '\n');
  }

  /**
   * Success log
   */
  success(message, data = null) {
    console.log(`✅ [${this.module}] ${message}`);
    if (data) {
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Error log
   */
  error(message, error = null) {
    console.error(`❌ [${this.module}] ${message}`);
    if (error) {
      if (error.message) console.error('📋 Error:', error.message);
      if (error.stack && process.env.NODE_ENV === 'development') {
        console.error('📋 Stack:', error.stack);
      }
    }
  }

  /**
   * Warning log
   */
  warn(message, data = null) {
    console.warn(`⚠️ [${this.module}] ${message}`);
    if (data) {
      console.warn('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Info log
   */
  info(message, data = null) {
    console.log(`ℹ️ [${this.module}] ${message}`);
    if (data) {
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Debug log
   */
  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [${this.module}] ${message}`);
      if (data) {
        console.log('📊 Data:', JSON.stringify(data, null, 2));
      }
    }
  }

  /**
   * Request log
   */
  request(method, path, user = null) {
    console.log(`\n📍 [${this.module}] ${method} ${path}`);
    if (user) {
      console.log(`👤 User: ${user.email} (${user.role})`);
    }
  }

  /**
   * Response log
   */
  response(statusCode, message) {
    const emoji = statusCode >= 400 ? '❌' : statusCode >= 300 ? '🔄' : '✅';
    console.log(`${emoji} [${this.module}] Response: ${statusCode} - ${message}`);
  }

  /**
   * Database log
   */
  database(operation, collection, data = null) {
    console.log(`🗄️ [${this.module}] DB ${operation} on ${collection}`);
    if (data) {
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Permission log
   */
  permission(allowed, resource, user = null) {
    const emoji = allowed ? '✅' : '❌';
    console.log(`🔐 [${this.module}] ${emoji} Permission ${allowed ? 'granted' : 'denied'} for ${resource}`);
    if (user) {
      console.log(`👤 User: ${user.email} (${user.role})`);
    }
  }

  /**
   * Workflow log
   */
  workflow(action, fromStatus, toStatus, data = null) {
    console.log(`🔄 [${this.module}] Workflow: ${action}`);
    console.log(`   From: ${fromStatus} → To: ${toStatus}`);
    if (data) {
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Notification log
   */
  notification(type, recipient, title) {
    console.log(`📧 [${this.module}] Notification (${type})`);
    console.log(`   To: ${recipient}`);
    console.log(`   Title: ${title}`);
  }

  /**
   * Performance log
   */
  performance(operation, duration) {
    const emoji = duration > 1000 ? '⚠️' : '⚡';
    console.log(`${emoji} [${this.module}] ${operation} took ${duration}ms`);
  }

  /**
   * Validation log
   */
  validation(field, valid, message = null) {
    const emoji = valid ? '✅' : '❌';
    console.log(`${emoji} [${this.module}] Validation ${field}: ${valid ? 'passed' : 'failed'}`);
    if (message) {
      console.log(`   Message: ${message}`);
    }
  }

  /**
   * Create a child logger with different module name
   */
  child(moduleName) {
    return new Logger(moduleName);
  }
}

// Export singleton instance
module.exports = new Logger('APP');

// Also export class for creating custom loggers
module.exports.Logger = Logger;
